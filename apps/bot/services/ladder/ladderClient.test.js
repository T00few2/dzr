const test = require("node:test");
const assert = require("node:assert/strict");
const { refreshSignups, refreshFixture } = require("./ladderClient");

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
  const fixture = { id: "1", zwiftEventId: null };
  assert.equal(await refreshFixture(fixture), fixture);
});
