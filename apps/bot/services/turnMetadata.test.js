const test = require("node:test");
const assert = require("node:assert/strict");

const { createTurnMetadataStore } = require("./turnMetadata");

test("looks up metadata for every message of a split reply", () => {
  const store = createTurnMetadataStore();
  store.remember(["m1", "m2"], { tools: ["get_wellness"], reasoningEffort: "medium" });
  assert.deepEqual(store.lookup("m2"), { tools: ["get_wellness"], reasoningEffort: "medium" });
  assert.deepEqual(store.lookup("m1"), store.lookup("m2"));
  assert.equal(store.lookup("unknown"), null);
});

test("forgets entries older than the age limit", () => {
  let clock = 0;
  const store = createTurnMetadataStore({ maxAgeMs: 1000, now: () => clock });
  store.remember("m1", { tools: [] });
  clock = 1001;
  assert.equal(store.lookup("m1"), null);
});

test("drops the oldest entries beyond the size limit", () => {
  let clock = 0;
  const store = createTurnMetadataStore({ maxEntries: 2, now: () => clock });
  store.remember("a", { n: 1 });
  clock = 1;
  store.remember("b", { n: 2 });
  clock = 2;
  store.remember("c", { n: 3 });
  assert.equal(store.size(), 2);
  assert.equal(store.lookup("a"), null);
  assert.deepEqual(store.lookup("c"), { n: 3 });
});

test("ignores empty ids", () => {
  const store = createTurnMetadataStore();
  store.remember([null, undefined, ""], { n: 1 });
  store.remember(null, { n: 1 });
  assert.equal(store.size(), 0);
});
