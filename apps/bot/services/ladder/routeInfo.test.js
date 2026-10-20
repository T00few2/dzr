const test = require("node:test");
const assert = require("node:assert/strict");
const { describeProfile, loadMatchProfile } = require("./routeInfo");

test("describeProfile uses the race distance and the altitude gain", () => {
  const info = describeProfile({ raceKm: 10, altitudeM: [0, 100, 80, 200] });
  assert.equal(info.distKm, 10);
  assert.equal(info.elevM, 220);
  assert.equal(info.kind, "Kuperet");
});

test("describeProfile is null without a profile", () => {
  assert.equal(describeProfile(null), null);
  assert.equal(describeProfile({ raceKm: 0, altitudeM: [1, 2] }), null);
});

test("loadMatchProfile asks the site for laps or a fixed distance", async () => {
  const requests = [];
  const fetchProfile = async (request) => {
    requests.push(request);
    return { success: true, profile: { raceKm: 12 } };
  };
  const laps = await loadMatchProfile({ route: "Croissant", world: "France", laps: 3 }, fetchProfile);
  assert.equal(laps.raceKm, 12);
  assert.deepEqual(requests[0], { world: "France", route: "Croissant", laps: 3, distanceKm: 0 });

  await loadMatchProfile({ route: "Croissant", world: "France", laps: 3, distance: 15000 }, fetchProfile);
  assert.deepEqual(requests[1], { world: "France", route: "Croissant", laps: 1, distanceKm: 15 });

  assert.equal(await loadMatchProfile({ route: "" }, fetchProfile), null);
  assert.equal(requests.length, 2);
});
