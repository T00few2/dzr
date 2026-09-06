const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resampleTo1Hz,
  meanMaxPower,
  normalizedPower,
  intensityFactor,
  trainingStressScore,
  aerobicDecoupling,
  timeInZones,
  detectIntervals,
} = require("./streamMetrics");

test("irregular sampling is placed on a real time grid, not by array index", () => {
  // Smart recording: samples at 0s, 10s, 20s, 30s. Treating the array as 1 Hz would compress a
  // 30-second effort into 4 seconds and inflate every rolling metric.
  const time = [0, 10, 20, 30];
  const watts = [100, 200, 300, 400];
  const out = resampleTo1Hz(time, watts);
  assert.equal(out.length, 31, "one sample per second across the real duration");
  assert.equal(out[0], 100);
  assert.equal(out[10], 200);
  assert.equal(out[30], 400);
});

test("power gaps fill with zero, heart-rate gaps hold the last value", () => {
  const time = [0, 5];
  assert.equal(resampleTo1Hz(time, [200, 200], "zero")[3], 0, "coasting is zero watts");
  assert.equal(resampleTo1Hz(time, [150, 150], "hold")[3], 150, "a gap in HR is missing data, not a stopped heart");
});

test("mean-max power finds the best window, not the last one", () => {
  // 60s at 100W, then 60s at 300W, then 60s at 100W.
  const watts = [...Array(60).fill(100), ...Array(60).fill(300), ...Array(60).fill(100)];
  const mmp = meanMaxPower(watts, [60]);
  assert.equal(mmp[60], 300);
});

test("mean-max returns null for durations longer than the ride", () => {
  assert.equal(meanMaxPower(Array(60).fill(200), [3600])[3600], null);
});

test("normalized power exceeds average power on a variable ride", () => {
  const steady = Array(600).fill(200);
  const variable = [];
  for (let i = 0; i < 600; i++) variable.push(i % 120 < 60 ? 100 : 300);
  const avg = 200;
  assert.equal(normalizedPower(steady), avg, "steady riding: NP equals average");
  assert.ok(normalizedPower(variable) > avg, "surges cost more than their average suggests");
});

test("intensity and stress scale as expected against threshold", () => {
  assert.equal(intensityFactor(250, 250), 1);
  assert.equal(intensityFactor(200, 250), 0.8);
  assert.equal(intensityFactor(200, 0), null, "no FTP, no claim");
  // An hour exactly at threshold is 100 by definition.
  assert.equal(trainingStressScore(250, 250, 3600), 100);
  assert.equal(trainingStressScore(250, 250, 1800), 50);
});

test("decoupling is near zero for a steady ride and positive when HR drifts up", () => {
  const steady = Array(1200).fill(200);
  const flatHr = Array(1200).fill(140);
  assert.equal(aerobicDecoupling(steady, flatHr), 0);

  // Same power, higher heart rate in the second half: cardiac cost rising.
  const driftHr = [...Array(600).fill(140), ...Array(600).fill(154)];
  const drift = aerobicDecoupling(steady, driftHr);
  assert.ok(drift > 5, `expected meaningful drift, got ${drift}`);
});

test("decoupling refuses to answer on too little data", () => {
  assert.equal(aerobicDecoupling(Array(120).fill(200), Array(120).fill(140)), null);
  assert.equal(aerobicDecoupling(Array(1200).fill(200), Array(1200).fill(0)), null, "no usable HR");
});

test("time in zones buckets every second, including above the top boundary", () => {
  const watts = [...Array(10).fill(50), ...Array(20).fill(150), ...Array(30).fill(400)];
  const zones = timeInZones(watts, [100, 200]);
  assert.deepEqual(zones, [10, 20, 30]);
  assert.equal(zones.reduce((a, b) => a + b, 0), watts.length);
});

test("intervals are detected, and a brief dip does not split one in two", () => {
  const watts = [
    ...Array(60).fill(100),
    ...Array(120).fill(300),
    ...Array(5).fill(80), // momentary freewheel mid-effort
    ...Array(120).fill(300),
    ...Array(60).fill(100),
  ];
  const found = detectIntervals(watts, { thresholdWatts: 250, minSeconds: 30, bridgeSeconds: 10 });
  assert.equal(found.length, 1, "the dip is bridged rather than reported as two efforts");
  assert.ok(found[0].durationSeconds >= 240);
  assert.equal(found[0].peakWatts, 300);
});

test("short surges are not reported as intervals", () => {
  const watts = [...Array(60).fill(100), ...Array(10).fill(400), ...Array(60).fill(100)];
  assert.equal(detectIntervals(watts, { thresholdWatts: 250, minSeconds: 30 }).length, 0);
});

test("empty and malformed input never throws", () => {
  assert.deepEqual(resampleTo1Hz([], []), []);
  assert.deepEqual(resampleTo1Hz(null, null), []);
  assert.equal(normalizedPower([]), null);
  assert.deepEqual(detectIntervals([], { thresholdWatts: 250 }), []);
  assert.equal(timeInZones([], []), null);
});
