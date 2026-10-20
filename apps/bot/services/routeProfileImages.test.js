const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRouteProfileImages } = require("./routeProfileImages");

const profile = {
  routeName: "Road to Sky",
  raceKm: 17.6,
  leadInKm: 0.1,
  distanceKm: [0.1, 5, 17.4],
  altitudeM: [100, 20, 1050],
  segments: [{ name: "Alpe du Zwift", type: "climb", fromKm: 5.1, toKm: 17.37 }],
  climbs: [],
};

const render = {
  renderRouteProfile: () => Buffer.from("profile"),
  renderClimbZoom: () => Buffer.from("zoom"),
};

test("resolves the exact route and world before asking the site", async () => {
  const requests = [];
  const result = await buildRouteProfileImages({ route: "road to sky" }, {
    render,
    getRouteProfile: async (req) => {
      requests.push(req);
      return { success: true, profile };
    },
  });
  assert.equal(result.success, true);
  assert.deepEqual(requests[0], { world: "Watopia", route: "Road to Sky", laps: 1, climbs: [] });
  assert.equal(result.files.length, 1);
  assert.match(result.caption, /\*\*Road to Sky\*\* · Watopia · 17\.6 km · 1030 m · incl\. 0\.1 km lead-in/);
});

test("adds close-ups of the route's climbs when asked", async () => {
  const result = await buildRouteProfileImages({ route: "Road to Sky", closeups: true }, {
    render,
    getRouteProfile: async () => ({ success: true, profile }),
  });
  assert.deepEqual(result.files.map((f) => f.name), ["road-to-sky-profile.png", "alpe-du-zwift-closeup.png"]);
});

test("reports a route it cannot find instead of guessing", async () => {
  const result = await buildRouteProfileImages({ route: "No Such Route 2099" }, { render, getRouteProfile: async () => assert.fail() });
  assert.equal(result.success, false);
});

test("passes on the site's error", async () => {
  const result = await buildRouteProfileImages({ route: "Road to Sky" }, {
    render,
    getRouteProfile: async () => ({ success: false, message: "The site has no elevation profile for that route." }),
  });
  assert.deepEqual(result, { success: false, message: "The site has no elevation profile for that route." });
});
