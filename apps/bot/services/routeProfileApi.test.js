const test = require("node:test");
const assert = require("node:assert/strict");

const { profileUrl } = require("./routeProfileApi");

function params(url) {
  return Object.fromEntries(new URL(url).searchParams);
}

test("a distance wins over laps", () => {
  const q = params(profileUrl({ world: "Watopia", route: "Three Sisters", laps: 2, distanceKm: 23.4 }, "https://site"));
  assert.equal(q.distance, "23.4");
  assert.equal(q.laps, undefined);
});

test("custom KOMs and the finish go through in the site's format", () => {
  const q = params(profileUrl({
    world: "Watopia",
    route: "Three Sisters",
    ranges: [{ name: "Ramp", fromKm: 1, toKm: 2 }],
    finish: "banner on top of Epic KOM",
  }, "https://site"));
  assert.deepEqual(JSON.parse(q.ranges), [{ name: "Ramp", fromKm: 1, toKm: 2 }]);
  assert.equal(q.finish, "banner on top of Epic KOM");
});

test("laps only when more than one", () => {
  assert.equal(params(profileUrl({ route: "R", laps: 1 }, "https://site")).laps, undefined);
  assert.equal(params(profileUrl({ route: "R", laps: 3 }, "https://site")).laps, "3");
});
