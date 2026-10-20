const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRouteProfile } = require("./routeProfile");

// 0.01 degrees of latitude is about 1112 m. The lap goes out and back, so it is a loop of two steps.
const STEP = 1111.95;
const route = {
  leadIn: [[0, 0, 10], [0.01, 0, 12]],
  lap: [[0.01, 0, 12], [0.02, 0, 20], [0.01, 0, 12]],
  worldSegments: [],
};

test("two laps: lead-in plus two full laps", () => {
  const profile = buildRouteProfile(route, { laps: 2 });
  assert.ok(Math.abs(profile.leadInDist - STEP) < 2);
  assert.ok(Math.abs(profile.totalDist - 5 * STEP) < 4, `total was ${profile.totalDist}`);
  assert.deepEqual(profile.laps.map((l) => l.partial), [false, false]);
  assert.deepEqual(profile.elevation[0], [0, 10]);
});

test("a fixed distance ends in a partial last lap at that distance", () => {
  const profile = buildRouteProfile(route, { distance: 4000 });
  assert.deepEqual(profile.laps.map((l) => l.partial), [false, true]);
  assert.ok(Math.abs(profile.totalDist - 4000) < 10, `total was ${profile.totalDist}`);
});

test("a fixed distance shorter than the lead-in produces no laps", () => {
  const profile = buildRouteProfile(route, { distance: 500 });
  assert.equal(profile.laps.length, 0);
  assert.ok(Math.abs(profile.totalDist - profile.leadInDist) < 1);
});

test("without segments there are no markers or bars", () => {
  const profile = buildRouteProfile(route, { laps: 1 });
  assert.deepEqual(profile.markers, []);
  assert.deepEqual(profile.bars, []);
});
