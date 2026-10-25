const test = require("node:test");
const assert = require("node:assert/strict");

const { bestPowerCurve } = require("./powerCurves");

test("bestPowerCurve takes the best ride per duration and keeps where it came from", () => {
  const curve = bestPowerCurve({
    secs: [5, 300, 3600],
    curves: [
      { id: "i1", start_date_local: "2026-01-10T17:00:00", weight: 80, watts: [900, 320, 250] },
      { id: "i2", start_date_local: "2026-02-03T18:30:00", weight: 79, watts: [1100, 310, 0] },
    ],
  });
  assert.equal(curve.rides, 2);
  assert.deepEqual(curve.points, [
    { seconds: 5, watts: 1100, w_per_kg: 13.92, date: "2026-02-03", activity_id: "i2" },
    { seconds: 300, watts: 320, w_per_kg: 4, date: "2026-01-10", activity_id: "i1" },
    { seconds: 3600, watts: 250, w_per_kg: 3.13, date: "2026-01-10", activity_id: "i1" },
  ]);
});

test("bestPowerCurve drops durations no ride reached and survives missing data", () => {
  const curve = bestPowerCurve({
    secs: [60, 3600],
    curves: [{ id: 7, start_date_local: "2026-02-01", watts: [400] }],
  });
  assert.deepEqual(curve.points, [
    { seconds: 60, watts: 400, w_per_kg: null, date: "2026-02-01", activity_id: "7" },
  ]);
  assert.deepEqual(bestPowerCurve(null), { rides: 0, points: [] });
});
