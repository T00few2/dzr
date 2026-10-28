const test = require("node:test");
const assert = require("node:assert/strict");

const { clearZwiftCatalog, getZwiftCatalog, loadZwiftCatalog, setZwiftCatalog } = require("./zwiftCatalog");
const { routeDetails } = require("./zwiftRoutes");

test("loads the website catalog and keeps it when a later fetch fails", async () => {
  clearZwiftCatalog();
  const calls = [];
  const http = {
    get: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return { status: 200, data: { routes: [{ name: "Spiral Summit", world: "watopia" }], segments: [], worlds: [{ slug: "watopia", name: "Watopia" }] } };
      }
      throw new Error("down");
    },
  };
  const origin = "https://example.test/";
  const loaded = await loadZwiftCatalog({ http, origin, force: true });
  assert.equal(calls[0], "https://example.test/api/zwift-catalog");
  assert.equal(loaded.routes[0].name, "Spiral Summit");
  assert.equal(routeDetails("spiral summit").route.world, "Watopia");

  const kept = await loadZwiftCatalog({ http, origin, force: true });
  assert.equal(kept.routes[0].name, "Spiral Summit");

  const cached = await loadZwiftCatalog({ http, origin, now: Date.now() });
  assert.equal(calls.length, 2);
  assert.equal(cached, getZwiftCatalog());
});

test("rejects a catalog that is missing a list", () => {
  assert.throws(() => setZwiftCatalog({ routes: [] }), /routes, segments and worlds/);
});
