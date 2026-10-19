const test = require("node:test");
const assert = require("node:assert");
const { groupRideRoute } = require("./groupRide");

const routes = [
  { routeId: 1, name: "Alpha", world: null },
  { routeId: 2, name: "Bravo", world: null },
  { routeId: 3, name: "Charlie", world: null },
];

test("category A follows the list and wraps", () => {
  assert.strictEqual(groupRideRoute(routes, "2026-10-07", 0, {}, "2026-10-07").name, "Alpha");
  assert.strictEqual(groupRideRoute(routes, "2026-10-07", 0, {}, "2026-10-14").name, "Bravo");
  assert.strictEqual(groupRideRoute(routes, "2026-10-07", 0, {}, "2026-10-28").name, "Alpha");
});

test("an override replaces one week", () => {
  assert.strictEqual(groupRideRoute(routes, "2026-10-07", 0, { "2026-10-14": 3 }, "2026-10-14").name, "Charlie");
  assert.strictEqual(groupRideRoute(routes, "2026-10-07", 0, { "2026-10-14": 3 }, "2026-10-21").name, "Charlie");
});
