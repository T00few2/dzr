const test = require("node:test");
const assert = require("node:assert/strict");

const { createZwiftRoutes } = require("./zwiftRoutes");

const data = {
  worlds: [{ slug: "watopia", name: "Watopia" }, { slug: "france", name: "France" }],
  segments: [
    { slug: "alpe", name: "Alpe du Zwift", type: "climb", world: "watopia", distance: 12.4, elevation: 1036, avgIncline: 8.5 },
    { slug: "fuego", name: "Fuego Flats", type: "segment", world: "watopia", distance: 7 },
  ],
  routes: [
    { name: "Road to Sky", slug: "road-to-sky", world: "watopia", distance: 17.5, elevation: 1044, leadInDistance: 0.1, sports: ["cycling"], segments: ["alpe"], segmentsOnRoute: [{ segment: "alpe", from: 5, to: 17.4 }] },
    { name: "Tempus Fugit", slug: "tempus-fugit", world: "watopia", distance: 17.2, elevation: 26, leadInDistance: 2.4, sports: ["cycling"], segments: ["fuego"], segmentsOnRoute: [] },
    { name: "Suki's Playground", slug: "sukis", world: "watopia", distance: 16.9, elevation: 92, sports: ["running", "cycling"], segments: [] },
    { name: "Petit Boucle", slug: "pb", world: "france", distance: 9, elevation: 200, eventOnly: true, sports: ["cycling"], segments: [] },
    { name: "Run Only", slug: "run", world: "france", distance: 5, elevation: 10, sports: ["running"], segments: [] },
  ],
};
const routes = createZwiftRoutes(data);

test("finds a route ignoring apostrophes and case", () => {
  const result = routes.routeDetails("sukis playground");
  assert.equal(result.route.name, "Suki's Playground");
});

test("route details list segments with names and positions, and the rest separately", () => {
  assert.deepEqual(routes.routeDetails("Road to Sky").route.segments_on_route, [{ name: "Alpe du Zwift", type: "climb", from_km: 5, to_km: 17.4 }]);
  assert.deepEqual(routes.routeDetails("Tempus Fugit").route.other_segments, ["Fuego Flats"]);
});

test("an ambiguous name asks to pick instead of guessing", () => {
  const result = routes.routeDetails("t");
  assert.equal(result.success, false);
  assert.ok(result.candidates.length >= 2);
});

test("filters by world, distance and elevation, cycling only by default", () => {
  const hilly = routes.searchRoutes({ world: "watopia", min_elevation: 500 });
  assert.deepEqual(hilly.routes.map((r) => r.name), ["Road to Sky"]);
  const france = routes.searchRoutes({ world: "France" });
  assert.deepEqual(france.routes.map((r) => r.name), ["Petit Boucle"]);
  assert.equal(france.routes[0].event_only, true);
  assert.equal(routes.searchRoutes({ world: "France", include_event_only: false }).total_matches, 0);
});

test("an unknown world is reported, not silently ignored", () => {
  const result = routes.searchRoutes({ world: "Mars" });
  assert.equal(result.success, false);
  assert.deepEqual(result.worlds, ["Watopia", "France"]);
});

test("segment search lists the routes that include it", () => {
  const [alpe] = routes.searchSegments({ query: "alpe" }).segments;
  assert.equal(alpe.avg_incline_pct, 8.5);
  assert.deepEqual(alpe.example_routes, ["Road to Sky"]);
});

test("a missing route points the helper to the web", () => {
  assert.match(routes.routeDetails("Brand New Route 2027").message, /web/);
});

test("live tools wait for the website catalog instead of guessing a miss", () => {
  const { searchRoutes } = require("./zwiftRoutes");
  const { clearZwiftCatalog } = require("./zwiftCatalog");
  clearZwiftCatalog();
  assert.match(searchRoutes({ query: "road" }).message, /unavailable/);
});

test("the shared tool runner dispatches every declared route tool", () => {
  const { zwiftRouteToolDefinitions, runZwiftRouteTool } = require("./zwiftRoutes");
  const args = { zwift_routes: {}, zwift_route_details: { route: "Road to Sky" }, zwift_segments: {} };
  for (const tool of zwiftRouteToolDefinitions) {
    assert.equal(runZwiftRouteTool(tool.function.name, args[tool.function.name], routes).success, true, tool.function.name);
  }
});
