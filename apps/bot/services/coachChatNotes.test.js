const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatCoachToday,
  formatNoteAge,
  sanitizeEventDate,
  activeGoalNotes,
  isNearDuplicate,
  shouldSkipExtract,
  parseExtractedNotes,
  retrieveRelevantNotes,
  searchNotes,
  MAX_ACTIVE_GOALS,
} = require("./coachChatNotes");

// Midday UTC keeps every fixture unambiguously on its intended Copenhagen calendar day.
const at = (iso) => new Date(`${iso}T12:00:00Z`);

test("this week runs Monday to Sunday, and Sunday is the last day", () => {
  // Sunday. The classic failure is treating Sunday as the start of the next week.
  const sunday = formatCoachToday(at("2026-09-06"));
  assert.equal(sunday.iso, "2026-09-06");
  assert.equal(sunday.weekday, "Sunday");
  assert.equal(sunday.weekMonday, "2026-08-31");
  assert.equal(sunday.weekSunday, "2026-09-06");

  const monday = formatCoachToday(at("2026-09-07"));
  assert.equal(monday.weekMonday, "2026-09-07", "Monday starts a new week");
  assert.equal(monday.weekSunday, "2026-09-13");
});

test("week boundaries survive both Danish DST transitions", () => {
  // Spring forward: last Sunday in March.
  const spring = formatCoachToday(at("2026-03-29"));
  assert.equal(spring.iso, "2026-03-29");
  assert.equal(spring.weekMonday, "2026-03-23");
  assert.equal(spring.weekSunday, "2026-03-29");

  // Fall back: last Sunday in October.
  const autumn = formatCoachToday(at("2026-10-25"));
  assert.equal(autumn.iso, "2026-10-25");
  assert.equal(autumn.weekMonday, "2026-10-19");
  assert.equal(autumn.weekSunday, "2026-10-25");
});

test("the Today line states the date and the week range", () => {
  const today = formatCoachToday(at("2026-09-06"));
  assert.match(today.line, /2026-09-06/);
  assert.match(today.line, /Europe\/Copenhagen/);
  assert.match(today.line, /2026-08-31–2026-09-06/);
});

test("note age is expressed in calendar days, not elapsed hours", () => {
  const now = at("2026-09-06");
  assert.equal(formatNoteAge(at("2026-09-06"), now), "today");
  assert.equal(formatNoteAge(at("2026-09-05"), now), "yesterday");
  assert.equal(formatNoteAge(at("2026-09-01"), now), "5 days ago");
  assert.equal(formatNoteAge(at("2026-08-23"), now), "2 weeks ago");
  assert.equal(formatNoteAge(at("2026-06-06"), now), "3 months ago");
});

test("event dates must be well formed, not in the past, and within two years", () => {
  const now = at("2026-09-06");
  assert.equal(sanitizeEventDate("2026-10-18", now), "2026-10-18");
  assert.equal(sanitizeEventDate("2026-09-06", now), "2026-09-06", "today is still valid");
  assert.equal(sanitizeEventDate("2026-09-05", now), null, "yesterday is not a goal date");
  assert.equal(sanitizeEventDate("18-10-2026", now), null);
  assert.equal(sanitizeEventDate("2030-01-01", now), null, "too far ahead");
  assert.equal(sanitizeEventDate("", now), null);
  assert.equal(sanitizeEventDate(null, now), null);
});

test("active goals drop expired dates, sort by date and cap at the limit", () => {
  const now = at("2026-09-06");
  const notes = [
    { kind: "goal", text: "ZRL final", eventDate: "2026-10-18" },
    { kind: "goal", text: "already gone", eventDate: "2026-01-01" },
    { kind: "goal", text: "lose 3 kg", eventDate: "2026-09-20" },
    { kind: "goal", text: "club champs", eventDate: "2026-11-01" },
    { kind: "goal", text: "fourth", eventDate: "2026-12-01" },
    { kind: "feeling", text: "tired", eventDate: "2026-10-01" },
  ];
  const active = activeGoalNotes(notes, now);
  assert.equal(active.length, MAX_ACTIVE_GOALS);
  assert.deepEqual(
    active.map((n) => n.eventDate),
    ["2026-09-20", "2026-10-18", "2026-11-01"]
  );
  assert.ok(!active.some((n) => n.kind !== "goal"), "only goals count");
});

test("near-duplicate detection catches restatements, not merely identical text", () => {
  const existing = [{ text: "Var syg i tirsdags og sprang intervallerne over" }];
  assert.ok(isNearDuplicate("Var syg i tirsdags og sprang intervallerne over", existing));
  assert.ok(isNearDuplicate("var syg i TIRSDAGS og sprang  intervallerne over", existing));
  assert.ok(!isNearDuplicate("Følte mig stærk i weekenden", existing));
  assert.ok(isNearDuplicate("", existing), "empty text is never worth storing");
});

test("extraction is skipped for acknowledgements and very short messages", () => {
  assert.ok(shouldSkipExtract("ja"));
  assert.ok(shouldSkipExtract("Nej."));
  assert.ok(shouldSkipExtract("tak!"));
  assert.ok(shouldSkipExtract("ok"));
  assert.ok(shouldSkipExtract("kort"));
  assert.ok(!shouldSkipExtract("Jeg var syg i tirsdags og sprang intervallerne over"));
});

test("extracted notes reject goals, dedupe, and cap the batch", () => {
  const fallback = "2026-09-06T12:00:00.000Z";
  const raw = JSON.stringify({
    notes: [
      { text: "Var syg mandag", kind: "feeling" },
      { text: "Var syg mandag", kind: "feeling" },
      { text: "ZRL-finalen er mit mål", kind: "goal", eventDate: "2026-10-18" },
      { text: "Kører ZRL på søndag", kind: "race" },
      { text: "Rejser i uge 40", kind: "life" },
    ],
  });
  const parsed = parseExtractedNotes(raw, fallback);
  assert.ok(!parsed.some((n) => n.kind === "goal"), "goals require explicit confirmation");
  assert.ok(!parsed.some((n) => n.kind === "race"));
  assert.equal(parsed.filter((n) => n.text === "Var syg mandag").length, 1, "deduped");
  assert.ok(parsed.length >= 2);
});

test("extracted notes survive a model that wraps JSON in prose", () => {
  const parsed = parseExtractedNotes(
    'Here you go:\n{"notes":[{"text":"Følte sig træt","kind":"feeling"}]}\nHope that helps',
    "2026-09-06T12:00:00.000Z"
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].kind, "feeling");
});

test("malformed extraction output yields nothing rather than throwing", () => {
  assert.deepEqual(parseExtractedNotes("not json at all", "2026-09-06T12:00:00.000Z"), []);
  assert.deepEqual(parseExtractedNotes("", "2026-09-06T12:00:00.000Z"), []);
  assert.deepEqual(parseExtractedNotes('{"notes":"wrong shape"}', "2026-09-06T12:00:00.000Z"), []);
});

test("retrieval pins active goals ahead of keyword matches", () => {
  const now = at("2026-09-06");
  const notes = [
    { id: "g", kind: "goal", text: "ZRL-finalen", eventDate: "2026-10-18", at: "2026-08-01T12:00:00.000Z" },
    { id: "k", kind: "feeling", text: "ondt i knæet efter intervaller", at: "2026-09-05T12:00:00.000Z" },
    { id: "o", kind: "life", text: "rejser til Spanien", at: "2026-05-01T12:00:00.000Z" },
  ];
  const hits = retrieveRelevantNotes(notes, "knæet gør ondt", { now });
  assert.equal(hits[0].id, "g", "goals lead");
  assert.ok(hits.some((n) => n.id === "k"), "keyword match retrieved");
  assert.ok(!hits.some((n) => n.id === "o"), "stale unrelated note not retrieved");
});

test("search honours the sinceDays window", () => {
  const now = at("2026-09-06");
  const notes = [
    { text: "syg i sengen", at: "2026-09-05T12:00:00.000Z" },
    { text: "syg sidste forår", at: "2026-03-01T12:00:00.000Z" },
  ];
  assert.equal(searchNotes(notes, "syg", { now }).length, 2);
  assert.equal(searchNotes(notes, "syg", { sinceDays: 7, now }).length, 1);
});
