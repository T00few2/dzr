const test = require("node:test");
const assert = require("node:assert/strict");

const { rangeCurveId, rangeCurves } = require("./powerCurves");

test("rangeCurveId uses intervals.icu's date-range curve syntax", () => {
  assert.equal(rangeCurveId("2026-01-01", "2026-02-28"), "r.2026-01-01.2026-02-28");
});

test("rangeCurves picks the coach durations with W/kg, ride and date", () => {
  const data = {
    list: [
      {
        id: "r.2026-01-01.2026-02-28",
        secs: [1, 5, 60, 300, 3600],
        values: [1200, 1100, 480, 330, 250],
        watts_per_kg: [15, 13.924, 6.08, 4.18, 3.16],
        activity_id: ["i1", "i2", "i2", "i3", "i3"],
      },
    ],
    activities: {
      i2: { start_date_local: "2026-02-03T18:30:00" },
      i3: { start_date_local: "2026-01-10T17:00:00" },
    },
  };
  const [curve] = rangeCurves(data, [{ oldest: "2026-01-01", newest: "2026-02-28" }]);
  assert.deepEqual(curve.points, [
    { seconds: 5, watts: 1100, w_per_kg: 13.92, date: "2026-02-03", activity_id: "i2" },
    { seconds: 60, watts: 480, w_per_kg: 6.08, date: "2026-02-03", activity_id: "i2" },
    { seconds: 300, watts: 330, w_per_kg: 4.18, date: "2026-01-10", activity_id: "i3" },
    { seconds: 3600, watts: 250, w_per_kg: 3.16, date: "2026-01-10", activity_id: "i3" },
  ]);
});

test("rangeCurves matches windows by id, falls back to order, and survives missing data", () => {
  const windows = [
    { oldest: "2026-01-01", newest: "2026-02-28" },
    { oldest: "2026-09-27", newest: "2026-10-25" },
  ];
  const data = {
    list: [
      { id: "r.2026-09-27.2026-10-25", secs: [60], values: [455] },
      { id: "r.2026-01-01.2026-02-28", secs: [60], values: [480] },
    ],
  };
  assert.deepEqual(rangeCurves(data, windows).map((c) => c.points[0].watts), [480, 455]);
  assert.deepEqual(
    rangeCurves({ list: [{ secs: [60], values: [400] }] }, windows.slice(0, 1))[0].points[0].watts,
    400
  );
  assert.deepEqual(rangeCurves(null, windows).map((c) => c.points), [[], []]);
});
