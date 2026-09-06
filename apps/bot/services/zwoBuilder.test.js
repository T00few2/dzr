const test = require("node:test");
const assert = require("node:assert/strict");

const { buildZwo, describeWorkout, workoutDuration } = require("./zwoBuilder");

const vo2 = {
  name: "VO2 5x4",
  description: "Five by four at 105%",
  steps: [
    { type: "warmup", duration: 600, powerFrom: 0.45, powerTo: 0.75 },
    { type: "intervals", repeat: 5, onDuration: 240, offDuration: 240, onPower: 1.05, offPower: 0.55 },
    { type: "cooldown", duration: 600, powerFrom: 0.65, powerTo: 0.45 },
  ],
};

test("produces a well-formed Zwift workout file", () => {
  const { xml, filename } = buildZwo(vo2);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<workout_file>[\s\S]*<\/workout_file>/);
  assert.match(xml, /<sportType>bike<\/sportType>/);
  assert.match(xml, /<Warmup Duration="600" PowerLow="0\.45" PowerHigh="0\.75"\/>/);
  assert.match(xml, /<IntervalsT Repeat="5" OnDuration="240" OffDuration="240" OnPower="1\.05" OffPower="0\.55"\/>/);
  assert.equal(filename, "vo2-5x4.zwo");
});

test("power targets are FTP-relative, so the file is right even if our FTP estimate is not", () => {
  const { xml } = buildZwo(vo2);
  // 1.05 = 105% of whatever FTP the rider has set in Zwift, not absolute watts.
  assert.match(xml, /OnPower="1\.05"/);
  assert.doesNotMatch(xml, /watts/i);
});

test("XML is escaped, since names come from the model", () => {
  const { xml } = buildZwo({ name: 'Sweet & "Sour" <spot>', steps: [{ type: "steady", duration: 600 }] });
  assert.match(xml, /Sweet &amp; &quot;Sour&quot; &lt;spot&gt;/);
  assert.doesNotMatch(xml, /<name>[^<]*<spot>/, "an unescaped tag would make Zwift refuse the file");
});

test("absurd power and duration values are clamped rather than emitted", () => {
  const { xml } = buildZwo({
    name: "x",
    steps: [
      { type: "steady", duration: 999999, power: 12 },
      { type: "steady", duration: -5, power: -1 },
    ],
  });
  assert.doesNotMatch(xml, /Power="12"/);
  assert.match(xml, /Power="2\.5"/, "clamped to a hard sprint, not 1200% FTP");
  assert.doesNotMatch(xml, /Duration="-5"/);
});

test("duration accounts for interval repeats", () => {
  // 10 min warmup + 5 x (4 on + 4 off) + 10 min cooldown = 60 min.
  assert.equal(workoutDuration(vo2.steps), 3600);
});

test("a workout with no steps is refused rather than emitted empty", () => {
  assert.throws(() => buildZwo({ name: "empty", steps: [] }), /at least one step/);
});

test("the outline is legible without opening the file", () => {
  const text = describeWorkout(vo2.steps);
  assert.match(text, /Opvarmning 10 min/);
  assert.match(text, /5 × 4 min @ 105% FTP/);
  assert.match(text, /Nedkøling 10 min/);
});

test("filenames stay filesystem-safe", () => {
  assert.equal(buildZwo({ name: "Tærskel / 2×20 (hård!)", steps: [{ type: "steady", duration: 60 }] }).filename,
    "t-rskel-2-20-h-rd.zwo");
});
