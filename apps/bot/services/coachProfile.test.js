const test = require("node:test");
const assert = require("node:assert/strict");

const {
  emptyProfile,
  defaultProfile,
  publicFields,
  formatCoachProfileForPrompt,
  sanitizeFollowUpEveryDays,
} = require("./coachProfile");

test("a new profile does not pin the athlete to Danish", () => {
  // Seeding "da" here ran during /coach before the first message, which made the prompt's
  // "otherwise match the chat" branch unreachable and replied in Danish to English speakers.
  assert.equal(defaultProfile().style.language, null);
});

test("rides per week is clamped and self-correcting", () => {
  assert.deepEqual(publicFields({ ridesPerWeek: { min: 3, max: 5 } }).ridesPerWeek, { min: 3, max: 5 });
  assert.deepEqual(
    publicFields({ ridesPerWeek: { min: 5, max: 3 } }).ridesPerWeek,
    { min: 3, max: 5 },
    "reversed bounds are swapped rather than rejected"
  );
  assert.deepEqual(publicFields({ ridesPerWeek: { min: -4, max: 99 } }).ridesPerWeek, { min: 0, max: 14 });
  assert.equal(publicFields({ ridesPerWeek: null }).ridesPerWeek, null);
  assert.equal(publicFields({ ridesPerWeek: "lots" }).ridesPerWeek, null);
});

test("weekly slots accept Danish and English day names and drop unusable rows", () => {
  const weekly = publicFields({
    weekly: [
      { sport: "Cycling", days: ["mandag", "Wed", "søndag"] },
      { sport: "", days: ["mon"] },
      { sport: "running", days: [] },
      { sport: "running", days: ["bogus"] },
    ],
  }).weekly;
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].sport, "cycling");
  assert.deepEqual(weekly[0].days, ["mon", "wed", "sun"], "stored in week order");
  assert.equal(weekly[0].startTime, null, "time is optional and absent by default");
});

test("weekly slots keep an optional start time", () => {
  const weekly = publicFields({
    weekly: [
      { sport: "cycling", days: ["tue"], startTime: "19:00" },
      { sport: "cycling", days: ["tue"], startTime: "06:30" },
      { sport: "running", days: ["sat"], startTime: "half seven" },
    ],
  }).weekly;
  assert.equal(weekly.length, 3);
  assert.equal(weekly[0].startTime, "19:00");
  assert.equal(weekly[1].startTime, "06:30");
  assert.equal(weekly[2].startTime, null, "unusable times are dropped, the slot remains");
});

test("weekly slots are deduplicated", () => {
  const weekly = publicFields({
    weekly: [
      { sport: "cycling", days: ["mon"] },
      { sport: "cycling", days: ["mon"] },
    ],
  }).weekly;
  assert.equal(weekly.length, 1);
});

test("injuries keep an id so they can be deleted unambiguously", () => {
  const injuries = publicFields({
    injuries: [
      { text: "knee", status: "active" },
      { text: "", status: "active" },
      { id: "inj_fixed", text: "back", status: "recovered", started: "2026-01" },
    ],
  }).injuries;
  assert.equal(injuries.length, 2);
  assert.ok(injuries[0].id, "an id is generated when missing");
  assert.equal(injuries[1].id, "inj_fixed", "a supplied id is preserved");
  assert.equal(injuries[1].status, "recovered");
});

test("unknown style values fall back to null rather than reaching the prompt", () => {
  const style = publicFields({ style: { length: "enormous", language: "klingon", tone: "shouty" } }).style;
  assert.deepEqual(style, { length: null, language: null, tone: null, notes: "" });
});

test("style synonyms map to the canonical values", () => {
  const style = publicFields({ style: { length: "kort", language: "dansk", tone: "direkte" } }).style;
  assert.equal(style.length, "short");
  assert.equal(style.language, "da");
  assert.equal(style.tone, "direct");
});

test("check-in cadence only accepts the offered intervals", () => {
  assert.equal(sanitizeFollowUpEveryDays(7), 7);
  assert.equal(sanitizeFollowUpEveryDays("14"), 14);
  assert.equal(sanitizeFollowUpEveryDays(5), null);
  assert.equal(sanitizeFollowUpEveryDays(null), null);
});

test("goals are never carried on the profile", () => {
  // Goals live in chat notes and require explicit confirmation; the profile field is vestigial.
  assert.deepEqual(publicFields({ goals: [{ text: "smuggled in" }] }).goals, []);
});

test("an empty profile renders as a clear statement, not a blank block", () => {
  assert.equal(formatCoachProfileForPrompt(emptyProfile()), "No Coach settings stored yet.");
});

test("an active injury is rendered as a hard constraint", () => {
  const prompt = formatCoachProfileForPrompt({
    injuries: [{ id: "i1", text: "left knee pain", status: "active" }],
  });
  assert.match(prompt, /left knee pain \(active\)/);
  assert.match(prompt, /Never prescribe through an active injury/);
});

test("a recovered injury does not raise the hard constraint", () => {
  const prompt = formatCoachProfileForPrompt({
    injuries: [{ id: "i1", text: "old back strain", status: "recovered" }],
  });
  assert.match(prompt, /old back strain \(recovered\)/);
  assert.doesNotMatch(prompt, /Never prescribe through an active injury/);
});

test("ride frequency is stated as a ceiling the coach must respect", () => {
  const prompt = formatCoachProfileForPrompt({ ridesPerWeek: { min: 3, max: 4 } });
  assert.match(prompt, /3–4 per week/);
  assert.match(prompt, /do not infer a higher volume/);
});

test("weekly slot times reach the prompt as Copenhagen clock times", () => {
  const prompt = formatCoachProfileForPrompt({
    weekly: [{ sport: "cycling", days: ["tue", "thu"], startTime: "19:00" }],
  });
  assert.match(prompt, /cycling on Tuesday, Thursday at 19:00/);
  assert.match(prompt, /Europe\/Copenhagen/);
});

test("untimed weekly slots do not invent a clock time", () => {
  const prompt = formatCoachProfileForPrompt({
    weekly: [{ sport: "cycling", days: ["mon"] }],
  });
  assert.match(prompt, /cycling on Monday/);
  assert.doesNotMatch(prompt, / at /);
});
