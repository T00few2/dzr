const test = require("node:test");
const assert = require("node:assert/strict");
const { refreshSignups, refreshFixture, describeFailure, getFixtureStart } = require("./ladderClient");

const MIN = 60 * 1000;

test("refreshSignups calls the ladder once per 30 minutes per event", async () => {
  const calls = [];
  const fetchPage = async (path) => calls.push(path);
  const t0 = 1_800_000_000_000;

  assert.equal(await refreshSignups("5748317", { fetchPage, now: t0 }), true);
  assert.equal(await refreshSignups("5748317", { fetchPage, now: t0 + 29 * MIN }), false);
  assert.equal(await refreshSignups("5748317", { fetchPage, now: t0 + 31 * MIN }), true);
  assert.equal(await refreshSignups("5748999", { fetchPage, now: t0 + 31 * MIN }), true);
  assert.deepEqual(calls, ["/rSignups/5748317", "/rSignups/5748317", "/rSignups/5748999"]);
});

test("refreshSignups does nothing without an event id", async () => {
  let called = false;
  assert.equal(await refreshSignups(null, { fetchPage: async () => (called = true) }), false);
  assert.equal(called, false);
});

test("refreshSignups reports a failure instead of throwing and does not retry within the cooldown", async () => {
  let calls = 0;
  const fetchPage = async () => {
    calls += 1;
    throw new Error("429");
  };
  const t0 = 1_800_000_000_000;
  assert.equal(await refreshSignups("7000001", { fetchPage, now: t0 }), false);
  assert.equal(await refreshSignups("7000001", { fetchPage, now: t0 + MIN }), false);
  assert.equal(calls, 1);
});

test("refreshFixture returns the fixture unchanged when there is no event id", async () => {
  const fixture = { id: "1", zwiftEventId: null, start: "2999-01-01T00:00:00Z" };
  assert.equal(await refreshFixture(fixture), fixture);
});

test("refreshFixture leaves a match that has already started alone", async () => {
  const fixture = { id: "2", zwiftEventId: "7100001", start: "2026-10-05T17:30:00Z" };
  assert.equal(await refreshFixture(fixture, Date.parse("2026-10-21T12:00:00Z")), fixture);
});

test("getFixtureStart remembers a start time and retries when the page had none", async () => {
  const cache = new Map();
  let start = null;
  const load = async (id) => ({ id, start });

  assert.equal(await getFixtureStart("17507", { load, cache }), null);
  assert.equal(cache.has("17507"), false);

  start = "2026-10-28T18:40:00.000Z";
  assert.equal(await getFixtureStart("17507", { load, cache }), start);
  start = "1999-01-01T00:00:00.000Z";
  assert.equal(await getFixtureStart("17507", { load, cache }), "2026-10-28T18:40:00.000Z");
});

test("describeFailure names the API status, a timeout or a missing connection", () => {
  assert.equal(describeFailure({ response: { status: 502 } }), "API svarede 502");
  assert.equal(describeFailure({ response: { status: 401 } }), "API svarede 401");
  assert.equal(describeFailure({ code: "ECONNABORTED" }), "API svarede ikke i tide");
  assert.equal(describeFailure({ code: "ENOTFOUND" }), "ingen forbindelse til API");
});
