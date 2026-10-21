const test = require("node:test");
const assert = require("node:assert/strict");

const { getDcuRaces, resetCache, RACES_URL } = require("./dcuESerien");
// Three real races from the calendar API, trimmed: eCKD (past), DZR løbet, DBM (later).
const fixture = require("./__fixtures__/dcu-races.json");

function http() {
  const calls = [];
  return { calls, get: async (url) => { calls.push(url); return { data: fixture }; } };
}

const WEDNESDAY = Date.parse("2026-10-21T09:00:00Z");

test("finds Thursday's DZR løbet with its route and point segments", async () => {
  resetCache();
  const client = http();
  const result = await getDcuRaces({ query: "DZR løbet" }, { http: client, now: WEDNESDAY });
  assert.equal(client.calls[0], RACES_URL);
  assert.equal(result.today, "2026-10-21");
  const [race] = result.races;
  assert.equal(race.date, "2026-10-22T19:00");
  assert.equal(race.route, "Itza Party");
  assert.equal(race.world, "Watopia");
  assert.equal(race.distance_km, 46.2);
  assert.deepEqual(race.point_segments, ["Titans Grove KOM Reverse", "Woodland Sprint Reverse", "Sasquatch Sprint Reverse"]);
  assert.deepEqual(race.groups.map((g) => g.zwift_event_id), ["5731001", "5731002"]);
});

test("lists upcoming races in order, leaving finished ones out", async () => {
  resetCache();
  const result = await getDcuRaces({}, { http: http(), now: WEDNESDAY });
  assert.deepEqual(result.races.map((r) => r.name), ["DZR løbet", "DBM løbet"]);
});

test("filters by date, including past races on that date", async () => {
  resetCache();
  const result = await getDcuRaces({ date: "2026-09-17" }, { http: http(), now: WEDNESDAY });
  assert.deepEqual(result.races.map((r) => r.name), ["eCKD løbet"]);
});

test("caches the calendar between questions", async () => {
  resetCache();
  const client = http();
  await getDcuRaces({}, { http: client, now: WEDNESDAY });
  await getDcuRaces({ query: "DBM" }, { http: client, now: WEDNESDAY + 60_000 });
  assert.equal(client.calls.length, 1);
});

test("reports a failed load instead of throwing", async () => {
  resetCache();
  const result = await getDcuRaces({}, { http: { get: async () => { throw new Error("down"); } }, now: WEDNESDAY });
  assert.equal(result.success, false);
});
