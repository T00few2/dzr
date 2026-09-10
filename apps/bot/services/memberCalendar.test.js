const test = require("node:test");
const assert = require("node:assert");

const {
  sanitizeCalendarEntry,
  sanitizeStartTime,
  sanitizeSourceEventId,
  upcomingEntries,
  recentEntries,
  formatCalendarForPrompt,
  countRecentCoachEntries,
  MAX_ENTRY_TEXT,
} = require("./memberCalendar");

// Fixed "now" so nothing here depends on when the suite runs. Midday UTC, so Copenhagen agrees
// on the date — the boundary case gets its own test below.
const NOW = new Date("2026-09-07T12:00:00Z");

test("sanitizeCalendarEntry accepts a well-formed entry", () => {
  const entry = sanitizeCalendarEntry(
    { text: "DZR After Party (C)", eventDate: "2026-09-10", kind: "race", startTime: "15:17" },
    NOW
  );
  assert.deepStrictEqual(entry, {
    text: "DZR After Party (C)",
    eventDate: "2026-09-10",
    kind: "race",
    startTime: "15:17",
    source: "member",
    status: "planned",
    sourceEventId: null,
  });
});

test("sanitizeCalendarEntry rejects entries that cannot be stored", () => {
  assert.strictEqual(sanitizeCalendarEntry(null, NOW), null);
  assert.strictEqual(sanitizeCalendarEntry({ eventDate: "2026-09-10" }, NOW), null, "no text");
  assert.strictEqual(sanitizeCalendarEntry({ text: "x" }, NOW), null, "no date");
  assert.strictEqual(
    sanitizeCalendarEntry({ text: "x", eventDate: "2026-09-06" }, NOW),
    null,
    "a new entry cannot be created in the past"
  );
  assert.strictEqual(
    sanitizeCalendarEntry({ text: "x", eventDate: "2099-01-01" }, NOW),
    null,
    "more than two years out is a typo, not a plan"
  );
});

test("sanitizeCalendarEntry falls back rather than rejecting on unknown enums", () => {
  const entry = sanitizeCalendarEntry(
    { text: "ride", eventDate: "2026-09-10", kind: "brunch", source: "wat", status: "maybe" },
    NOW
  );
  assert.strictEqual(entry.kind, "session");
  assert.strictEqual(entry.source, "member");
  assert.strictEqual(entry.status, "planned");
});

test("sanitizeCalendarEntry clips long text", () => {
  const entry = sanitizeCalendarEntry({ text: "a".repeat(500), eventDate: "2026-09-10" }, NOW);
  assert.strictEqual(entry.text.length, MAX_ENTRY_TEXT);
});

test("sanitizeStartTime normalises and rejects", () => {
  assert.strictEqual(sanitizeStartTime("9:05"), "09:05");
  assert.strictEqual(sanitizeStartTime("19:30"), "19:30");
  assert.strictEqual(sanitizeStartTime("23:59"), "23:59");
  assert.strictEqual(sanitizeStartTime("24:00"), null);
  assert.strictEqual(sanitizeStartTime("19:60"), null);
  assert.strictEqual(sanitizeStartTime("half seven"), null);
  assert.strictEqual(sanitizeStartTime(""), null);
});

test("sanitizeSourceEventId only accepts opaque ids", () => {
  assert.strictEqual(sanitizeSourceEventId("5693445:7324055"), "5693445:7324055");
  assert.strictEqual(sanitizeSourceEventId("../../etc/passwd"), null);
  assert.strictEqual(sanitizeSourceEventId("has space"), null);
});

test("upcomingEntries spans today to the horizon and excludes the rest", () => {
  const entries = [
    { eventDate: "2026-09-06", text: "yesterday" },
    { eventDate: "2026-09-07", text: "today" },
    { eventDate: "2026-09-10", text: "soon" },
    { eventDate: "2026-11-06", text: "last day of a 60 day horizon" },
    { eventDate: "2026-11-07", text: "past the horizon" },
    { eventDate: "nonsense", text: "unparseable" },
  ];
  assert.deepStrictEqual(
    upcomingEntries(entries, NOW).map((e) => e.text),
    ["today", "soon", "last day of a 60 day horizon"]
  );
});

test("upcomingEntries uses Copenhagen's date, not the server's", () => {
  // 22:30 UTC on the 7th is already the 8th in Copenhagen, so the 7th is no longer upcoming.
  const lateEvening = new Date("2026-09-07T22:30:00Z");
  const entries = [{ eventDate: "2026-09-07", text: "tonight" }, { eventDate: "2026-09-08", text: "tomorrow" }];
  assert.deepStrictEqual(
    upcomingEntries(entries, lateEvening).map((e) => e.text),
    ["tomorrow"]
  );
});

test("upcomingEntries sorts by date then time, untimed entries last that day", () => {
  const entries = [
    { eventDate: "2026-09-10", startTime: null, text: "sometime Thursday" },
    { eventDate: "2026-09-10", startTime: "15:17", text: "After Party C" },
    { eventDate: "2026-09-08", startTime: "19:30", text: "ZRL" },
    { eventDate: "2026-09-10", startTime: "07:30", text: "morning Zone 2" },
  ];
  assert.deepStrictEqual(
    upcomingEntries(entries, NOW).map((e) => e.text),
    ["ZRL", "morning Zone 2", "After Party C", "sometime Thursday"]
  );
});

test("upcomingEntries tolerates junk input", () => {
  assert.deepStrictEqual(upcomingEntries(null, NOW), []);
  assert.deepStrictEqual(upcomingEntries(undefined, NOW), []);
  assert.deepStrictEqual(upcomingEntries([null, {}], NOW), []);
});

test("recentEntries covers the days just before today, oldest first", () => {
  const entries = [
    { eventDate: "2026-08-25", text: "too long ago" },
    { eventDate: "2026-08-28", text: "edge of a 10 day look-back" },
    { eventDate: "2026-09-05", text: "two days ago" },
    { eventDate: "2026-09-07", text: "today belongs to upcoming, not recent" },
    { eventDate: "2026-09-10", text: "future" },
  ];
  assert.deepStrictEqual(
    recentEntries(entries, NOW).map((e) => e.text),
    ["edge of a 10 day look-back", "two days ago"]
  );
});

test("recentEntries and upcomingEntries do not overlap", () => {
  const entries = [
    { eventDate: "2026-09-05", text: "past" },
    { eventDate: "2026-09-07", text: "today" },
    { eventDate: "2026-09-10", text: "future" },
  ];
  const recent = recentEntries(entries, NOW).map((e) => e.text);
  const upcoming = upcomingEntries(entries, NOW).map((e) => e.text);
  assert.deepStrictEqual(recent, ["past"]);
  assert.deepStrictEqual(upcoming, ["today", "future"]);
  assert.deepStrictEqual(recent.filter((t) => upcoming.includes(t)), [], "no entry in both windows");
});

test("formatCalendarForPrompt renders dates, times and coach attribution", () => {
  const entries = [
    { eventDate: "2026-09-10", startTime: "15:17", text: "After Party (C)", kind: "race", source: "member", status: "planned" },
    { eventDate: "2026-09-12", startTime: null, text: "easy 90 min", kind: "session", source: "coach", status: "planned" },
  ];
  const block = formatCalendarForPrompt(entries, NOW);

  assert.match(block, /2026-09-10 \(in 3 days\) at 15:17 — After Party \(C\) \(race\)$/m);
  assert.match(block, /easy 90 min \(session\) \[added by coach\]/);
  assert.doesNotMatch(block, /easy 90 min \(session\).*at /, "untimed rows must not invent a clock time");
  assert.doesNotMatch(
    block,
    /After Party \(C\) \(race\) \[added by coach\]/,
    "the athlete's own rows are unlabelled"
  );
  // Goals live in their own prompt section; repeating them here would duplicate the lines and
  // blur a confirmed commitment with a plan that may move.
  assert.doesNotMatch(block, /Goals:/);
});

test("formatCalendarForPrompt separates what was planned from what is coming", () => {
  const entries = [
    { eventDate: "2026-09-04", text: "4x8 tærskel", kind: "session", source: "coach", status: "planned" },
    { eventDate: "2026-09-05", text: "rolig tur", kind: "session", source: "member", status: "done" },
    { eventDate: "2026-09-10", startTime: "15:17", text: "After Party (C)", kind: "race", source: "member", status: "planned" },
  ];
  const block = formatCalendarForPrompt(entries, NOW);
  const lines = block.split("\n");

  assert.strictEqual(lines[0], "Recently planned:");
  assert.ok(lines.indexOf("Coming up:") > lines.indexOf("Recently planned:"));
  // The whole point of the look-back: a session planned three days ago is visible, still marked
  // planned, so the coach can ask whether it happened instead of assuming either way.
  assert.match(block, /2026-09-04 \(3 days ago\) — 4x8 tærskel \(session\) \[added by coach\]/);
  assert.match(block, /2026-09-05 \(2 days ago\) — rolig tur \(session\) \[done\]/);
  assert.match(block, /2026-09-10 \(in 3 days\) at 15:17 — After Party \(C\)/);
});

test("formatCalendarForPrompt can be asked for the forward view only", () => {
  const entries = [
    { eventDate: "2026-09-04", text: "past session", kind: "session", source: "member", status: "planned" },
    { eventDate: "2026-09-10", text: "future race", kind: "race", source: "member", status: "planned" },
  ];
  const block = formatCalendarForPrompt(entries, NOW, { includeRecent: false });
  assert.doesNotMatch(block, /Recently planned:/);
  assert.doesNotMatch(block, /past session/);
  assert.match(block, /future race/);
});

test("formatCalendarForPrompt is empty when there is nothing to say", () => {
  assert.strictEqual(formatCalendarForPrompt([], NOW), "");
  assert.strictEqual(formatCalendarForPrompt(null, NOW), "");
  assert.strictEqual(
    formatCalendarForPrompt([{ eventDate: "2027-06-01", text: "x" }], NOW),
    "",
    "an entry past the horizon must not produce an empty block"
  );
  assert.strictEqual(
    formatCalendarForPrompt([{ eventDate: "2026-01-01", text: "x" }], NOW),
    "",
    "nor one before the look-back"
  );
});

test("formatCalendarForPrompt marks non-planned status", () => {
  const block = formatCalendarForPrompt(
    [{ eventDate: "2026-09-08", text: "intervals", kind: "session", source: "member", status: "skipped" }],
    NOW
  );
  assert.match(block, /\[skipped\]/);
});

test("countRecentCoachEntries counts only coach rows from the last week", () => {
  const entries = [
    { source: "coach", createdAt: "2026-09-06T10:00:00Z" },
    { source: "coach", createdAt: "2026-09-01T10:00:00Z" },
    { source: "coach", createdAt: "2026-08-01T10:00:00Z" },
    { source: "member", createdAt: "2026-09-06T10:00:00Z" },
    { source: "coach", createdAt: "not a date" },
    { source: "coach" },
  ];
  assert.strictEqual(countRecentCoachEntries(entries, NOW), 2);
});
