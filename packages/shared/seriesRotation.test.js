const test = require("node:test");
const assert = require("node:assert");

const {
  routeForDate,
  listSeriesDates,
  displayDate,
  parseSheetDate,
  courseLength,
} = require("./seriesRotation");

const routes = ["Alpha", "Bravo", "Charlie"];

test("a date follows the catalog and wraps after the last route", () => {
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, {}, "2026-10-01"), "Alpha");
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, {}, "2026-10-08"), "Bravo");
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, {}, "2026-10-15"), "Charlie");
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, {}, "2026-10-22"), "Alpha");
});

test("an override changes that date only", () => {
  const overrides = { "2026-10-08": "Charlie" };
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, overrides, "2026-10-01"), "Alpha");
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, overrides, "2026-10-08"), "Charlie");
  assert.strictEqual(routeForDate(routes, "2026-10-01", 0, overrides, "2026-10-15"), "Charlie");
});

test("coming dates start at the latest event and step one week", () => {
  assert.deepStrictEqual(listSeriesDates("2026-10-01", ["2026-10-01", "2026-10-15"], 3), [
    "2026-10-15",
    "2026-10-22",
    "2026-10-29",
  ]);
});

test("display date matches the race pages", () => {
  assert.strictEqual(displayDate("2026-10-15"), "Thursday October 15");
});

test("sheet dates become ISO dates", () => {
  assert.strictEqual(parseSheetDate("2026-10-15"), "2026-10-15");
  assert.strictEqual(parseSheetDate("15-10-2026"), "2026-10-15");
  assert.strictEqual(parseSheetDate(""), null);
});

test("whole laps set laps, and 1+ or <1 set distance", () => {
  assert.deepStrictEqual(courseLength("2", "50.09"), { laps: 2 });
  assert.deepStrictEqual(courseLength("1+", "36.767"), { distanceMeters: 36767 });
  assert.deepStrictEqual(courseLength("<1", "36.47"), { distanceMeters: 36470 });
});
