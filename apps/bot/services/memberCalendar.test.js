const test = require("node:test");
const assert = require("node:assert");

const {
  sanitizeCalendarEntry,
  sanitizeStartTime,
  sanitizeSourceEventId,
  upcomingEntries,
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

test("formatCalendarForPrompt separates goals from plans and labels coach rows", () => {
  const entries = [
    { eventDate: "2026-09-10", startTime: "15:17", text: "After Party (C)", kind: "race", source: "member", status: "planned" },
    { eventDate: "2026-09-12", startTime: null, text: "easy 90 min", kind: "session", source: "coach", status: "planned" },
  ];
  const goals = [{ eventDate: "2026-10-01", text: "sub-60 on Alpe" }];
  const block = formatCalendarForPrompt(entries, goals, NOW);

  assert.match(block, /^Goals:/);
  assert.match(block, /2026-10-01 \(in 3 weeks\) — sub-60 on Alpe/);
  assert.match(block, /Planned:/);
  assert.match(block, /2026-09-10 \(in 3 days\) 15:17 — After Party \(C\) \(race\)/);
  assert.match(block, /\[added by coach\]/);
  assert.doesNotMatch(block, /After Party \(C\) \(race\) \[added by coach\]/, "member rows are unlabelled");
});

test("formatCalendarForPrompt is empty when there is nothing to say", () => {
  assert.strictEqual(formatCalendarForPrompt([], [], NOW), "");
  assert.strictEqual(formatCalendarForPrompt(null, null, NOW), "");
  // An entry outside the horizon must not produce a stray "Planned:" heading with nothing under it.
  assert.strictEqual(formatCalendarForPrompt([{ eventDate: "2027-06-01", text: "x" }], [], NOW), "");
});

test("formatCalendarForPrompt marks non-planned status", () => {
  const block = formatCalendarForPrompt(
    [{ eventDate: "2026-09-08", text: "intervals", kind: "session", source: "member", status: "skipped" }],
    [],
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
