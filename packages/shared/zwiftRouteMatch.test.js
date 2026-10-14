const test = require("node:test");
const assert = require("node:assert");

const { chooseZwiftRoute } = require("./zwiftRouteMatch");

const hits = [
  { routeId: 1, name: "Hilly Route Reverse" },
  { routeId: 2, name: "Hilly Route Reverse Run" },
  { routeId: 3, name: "Watopia Hilly Route" },
  { routeId: 4, name: "Tick Tock" },
  { routeId: 5, name: "Loop de Loop" },
  { routeId: 6, name: "Loop de loop de loop" },
];

test("a world prefix matches when the plain name is not in Zwift", () => {
  assert.strictEqual(chooseZwiftRoute(hits, "Hilly Route").routeId, 3);
});

test("an exact name wins over a longer name", () => {
  assert.strictEqual(chooseZwiftRoute(hits, "Loop de Loop").routeId, 5);
  assert.strictEqual(chooseZwiftRoute(hits, "Tick Tock").routeId, 4);
});

test("two different worlds for the same route name do not guess", () => {
  const both = hits.concat([{ routeId: 7, name: "London Hilly Route" }]);
  assert.strictEqual(chooseZwiftRoute(both, "Hilly Route"), null);
});
