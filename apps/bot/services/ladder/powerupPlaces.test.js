const test = require("node:test");
const assert = require("node:assert/strict");
const { placePowerups } = require("./powerupPlaces");

const profile = {
  raceKm: 20,
  leadInKm: 1,
  lapKm: 9.5,
  segments: [
    { name: "Sprint", type: "sprint", fromKm: 3, toKm: 4, archId: 4 },
    { name: "KOM", type: "climb", fromKm: 6, toKm: 8 },
  ],
};

function at(placed, km) {
  return placed.find((row) => Math.abs(row.atKm - km) < 0.001);
}

test("the bag sits on sprint and climb banners and on the lap banner", () => {
  const placed = placePowerups(profile, { powerupIds: [0, 1, 5], archPowerups: {} });
  assert.deepEqual(at(placed, 4).powerupIds, [0, 1, 5]);
  assert.deepEqual(at(placed, 8).powerupIds, [0, 1, 5]);
  assert.deepEqual(at(placed, 1).powerupIds, [0, 1, 5]);
  assert.deepEqual(at(placed, 10.5).powerupIds, [0, 1, 5]);
});

test("an arch override replaces the bag, including arch 0", () => {
  const placed = placePowerups(profile, { powerupIds: [0, 1], archPowerups: { 4: 5, 0: 3 } });
  assert.deepEqual(at(placed, 4).powerupIds, [5]);
  assert.deepEqual(at(placed, 8).powerupIds, [0, 1]);
  assert.deepEqual(at(placed, 1).powerupIds, [3]);
  assert.deepEqual(at(placed, 10.5).powerupIds, [3]);
});

test("named fallback powerups are placed when the bag ids are missing", () => {
  const placed = placePowerups(profile, { powerups: ["feather", "aero"], archPowerups: {} });
  assert.deepEqual(at(placed, 4).powerupIds, [0, 5]);
});

test("an empty list places nothing", () => {
  assert.deepEqual(placePowerups(profile, { powerups: [], archPowerups: {} }), []);
  assert.deepEqual(placePowerups(null, { powerupIds: [0] }), []);
});
