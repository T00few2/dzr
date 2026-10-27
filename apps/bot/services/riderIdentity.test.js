const test = require("node:test");
const assert = require("node:assert/strict");
const { lookupRiderIdentity, clearCacheForTests } = require("./riderIdentity");

const ZWIFT = { firstName: "Anna", lastName: "Hansen", countryCode: "dnk", avatar: "https://cdn.zwift.com/a.jpg", racingScore: 512, category: "B" };
const ZP = { data: [
  { name: ["Anna Hansen"], tname: ["DZR"], category: "C", event_date: 1700000000, event_title: ["Old race"] },
  { name: ["Anna Hansen"], tname: ["DZR"], category: "B", event_date: 1760000000, event_title: ["DZR After Party"] },
] };

function getter(responses) {
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    const key = path.startsWith("/zwift_profile") ? "zwift" : "zp";
    const response = responses[key];
    if (response instanceof Error) throw response;
    return response;
  };
  return { get, calls };
}

test.beforeEach(() => clearCacheForTests());

test("both sources found give the card", async () => {
  const result = await lookupRiderIdentity("123", getter({ zwift: ZWIFT, zp: ZP }));
  assert.equal(result.zwift.name, "Anna Hansen");
  assert.equal(result.zwift.country, "DNK");
  assert.equal(result.zp.category, "B");
  assert.equal(result.zp.team, "DZR");
  assert.deepEqual(result.zp.lastRace, { title: "DZR After Party", date: "2025-10-09" });
  assert.equal(result.zpUrl, "https://zwiftpower.com/profile.php?z=123");
});

test("a Zwift profile without ZwiftPower rows is a normal card (new rider)", async () => {
  const result = await lookupRiderIdentity("123", getter({ zwift: { ...ZWIFT, racingScore: null, category: null }, zp: {} }));
  assert.equal(result.zwift.name, "Anna Hansen");
  assert.equal(result.zp, null);
});

test("one source found and one errored still gives the card", async () => {
  const result = await lookupRiderIdentity("123", getter({ zwift: new Error("timeout"), zp: ZP }));
  assert.equal(result.zp.name, "Anna Hansen");
  assert.equal(result.zwift, null);
});

test("both clean misses are not found", async () => {
  assert.deepEqual(await lookupRiderIdentity("123", getter({ zwift: null, zp: { data: [] } })), { notFound: true });
});

test("a timeout or 5xx with nobody found is an error, not a missing rider", async () => {
  assert.deepEqual(await lookupRiderIdentity("123", getter({ zwift: new Error("timeout"), zp: {} })), { error: true });
  assert.deepEqual(await lookupRiderIdentity("123", getter({ zwift: { error: "Zwift down" }, zp: null })), { error: true });
});

test("only found identities are cached", async () => {
  const miss = getter({ zwift: null, zp: {} });
  await lookupRiderIdentity("123", miss);
  await lookupRiderIdentity("123", miss);
  assert.equal(miss.calls.length, 4);
  const error = getter({ zwift: new Error("x"), zp: new Error("y") });
  await lookupRiderIdentity("124", error);
  await lookupRiderIdentity("124", error);
  assert.equal(error.calls.length, 4);
  const found = getter({ zwift: ZWIFT, zp: ZP });
  await lookupRiderIdentity("125", found);
  await lookupRiderIdentity("125", found);
  assert.equal(found.calls.length, 2);
});
