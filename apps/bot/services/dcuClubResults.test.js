const test = require("node:test");
const assert = require("node:assert/strict");

const { getDcuResults, resetCache, formatFinish } = require("./dcuClubResults");
const { RACES_URL } = require("./dcuESerien");

const LOGIN = { username: "dzr", secret: "test-secret" };
const NOW = Date.parse("2026-10-22T20:30:00Z");

// Same shape as the public races list: results keyed by division, every club's riders included.
const RACES = {
  races: [
    {
      id: "eckd1",
      name: "eCKD løbet",
      date: "2026-09-17T19:00",
      resultsPhase: "finalized",
      results: {
        "2. Division": [
          { name: "Jacob Stauner", club: "Danish Zwift Racers", finishRank: 4, finishTime: 4000000, finishPoints: 100, sprintPoints: 0, totalPoints: 100, raceStatus: "FIN" },
        ],
      },
    },
    {
      id: "dzr1",
      name: "DZR løbet",
      date: "2026-10-22T19:00",
      resultsPhase: "finalized",
      results: {
        "1. Division": [
          { name: "Jacob Kvistgaard", club: "Holstebro Cycleclub af 1960", finishRank: 1, finishTime: 3901848, finishPoints: 130, sprintPoints: 24, totalPoints: 154, raceStatus: "FIN" },
          { name: "Emil Ringgaard", club: "Danish Zwift Racers", finishRank: 10, finishTime: 3918590, finishPoints: 118, sprintPoints: 6, totalPoints: 124, raceStatus: "FIN" },
        ],
        "2. Division": [
          { name: "Kim Damgaard", club: "Danish Zwift Racers", finishRank: 0, finishTime: 0, finishPoints: 0, sprintPoints: 0, totalPoints: 0, raceStatus: "DNF" },
          { name: "Jacob Stauner", club: "Danish Zwift Racers", finishRank: 1, finishTime: 4062211, finishPoints: 117, sprintPoints: 22, totalPoints: 139, raceStatus: "FIN" },
          { name: "Anders Andersen", club: "eCykle Klub Danmark", finishRank: 2, finishTime: 4062300, finishPoints: 115, sprintPoints: 0, totalPoints: 115, raceStatus: "FIN" },
        ],
      },
    },
    { id: "next1", name: "Næste løb", date: "2026-10-29T19:00", results: {} },
  ],
};

function http(handlers) {
  const calls = [];
  return {
    calls,
    get: async (url, config) => {
      calls.push({ url, authorization: config?.headers?.Authorization || "" });
      const hit = handlers.find((row) => url.includes(row.match));
      if (!hit) return { status: 404, data: { message: "missing" } };
      if (hit.throw) throw new Error("down");
      return { status: hit.status || 200, data: hit.data };
    },
  };
}

function client(extra = []) {
  return http([{ match: RACES_URL, data: RACES }, ...extra]);
}

test("formats finish times from milliseconds", () => {
  assert.equal(formatFinish(3918590), "1:05:18");
  assert.equal(formatFinish(0), null);
});

test("loads the latest race when no race is named", async () => {
  resetCache();
  const api = client();
  const result = await getDcuResults({}, { ...LOGIN, http: api, now: NOW });
  assert.equal(result.success, true);
  assert.equal(result.name, "DZR løbet");
  assert.equal(result.results_phase, "finalized");
  assert.equal(result.divisions[1].riders[0].name, "Jacob Stauner");
  assert.equal(result.divisions[1].riders[0].time, "1:07:42");
  assert.equal(result.divisions[1].riders[0].points, 139);
  assert.equal(result.divisions[1].riders[1].time, null);
  assert.equal(result.divisions[1].riders[1].status, "DNF");
  assert.equal(result.divisions[1].riders[1].position, null);
  assert.equal(result.divisions[1].field_size, 3);
  assert.deepEqual(result.divisions.flatMap((row) => row.riders.map((rider) => rider.name)), ["Emil Ringgaard", "Jacob Stauner", "Kim Damgaard"]);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url, RACES_URL);
  assert.equal(api.calls[0].authorization, "");
});

test("race results need no club login", async () => {
  resetCache();
  const result = await getDcuResults({ query: "DZR løbet" }, { username: "", secret: "", http: client(), now: NOW });
  assert.equal(result.success, true);
  assert.equal(result.divisions[0].riders[0].name, "Emil Ringgaard");
});

test("finds DZR løbet and can filter to one rider", async () => {
  resetCache();
  const result = await getDcuResults({ query: "DZR løbet", rider: "Emil" }, { ...LOGIN, http: client(), now: NOW });
  assert.equal(result.name, "DZR løbet");
  assert.deepEqual(result.divisions.map((row) => row.riders.map((rider) => rider.name)), [["Emil Ringgaard"]]);
  assert.equal(result.divisions[0].field_size, 2);
  assert.equal(result.divisions[0].riders[0].position, 10);
});

test("filters a division without dropping the rest of that division", async () => {
  resetCache();
  const result = await getDcuResults({ query: "DZR", division: "2" }, { ...LOGIN, http: client(), now: NOW });
  assert.deepEqual(result.divisions.map((row) => row.division), ["2. Division"]);
  assert.equal(result.divisions[0].riders.length, 2);
});

test("treats 'løbet' alone as the latest race", async () => {
  resetCache();
  const result = await getDcuResults({ query: "løbet" }, { ...LOGIN, http: client(), now: NOW });
  assert.equal(result.name, "DZR løbet");
});

test("asks which race when several match", async () => {
  resetCache();
  const api = http([
    {
      match: RACES_URL,
      data: {
        races: [
          { ...RACES.races[1] },
          { ...RACES.races[1], id: "dzr2", name: "DZR finale", date: "2026-11-19T19:00", resultsPhase: "provisional" },
        ],
      },
    },
  ]);
  const result = await getDcuResults({ query: "DZR" }, { ...LOGIN, http: api, now: Date.parse("2026-12-01T12:00:00Z") });
  assert.equal(result.message, "Several races matched. Ask which one.");
  assert.deepEqual(result.races.map((race) => race.name), ["DZR løbet", "DZR finale"]);
  assert.equal(api.calls.length, 1);
});

test("caches a repeated lookup", async () => {
  resetCache();
  const api = client();
  await getDcuResults({ query: "DZR" }, { ...LOGIN, http: api, now: NOW });
  await getDcuResults({ query: "DZR" }, { ...LOGIN, http: api, now: NOW + 30_000 });
  assert.equal(api.calls.length, 1);
});

test("reports a missing login, a rejected login, and a failed request", async () => {
  resetCache();
  assert.equal((await getDcuResults({ kind: "standings" }, { username: "", secret: "", http: client(), now: NOW })).success, false);
  resetCache();
  const rejected = await getDcuResults({ kind: "standings" }, { ...LOGIN, http: http([{ match: "/club-api/standings", status: 401, data: {} }]), now: NOW });
  assert.equal(rejected.success, false);
  assert.match(rejected.message, /rejected/);
  resetCache();
  const down = await getDcuResults({}, { ...LOGIN, http: http([{ match: RACES_URL, throw: true }]), now: NOW });
  assert.equal(down.success, false);
});

test("loads season standings and the club table", async () => {
  resetCache();
  const api = http([
    {
      match: "/club-api/standings",
      data: {
        divisions: [{
          category: "2. Division",
          riders: [{
            position: 1,
            name: "Jacob Stauner",
            totalPoints: 139,
            raceCount: 1,
            results: [{ raceName: "DZR løbet", date: "2026-10-22T19:00:00+00:00", points: 139, counting: true }],
          }],
        }],
      },
    },
    {
      match: "/club-api/club-standings",
      data: {
        clubs: [
          { rank: 1, club: "Other", points: 400, yours: false, riders: [] },
          { rank: 2, club: "Danish Zwift Racers", points: 300, yours: true, riders: [{ name: "Jacob Stauner", points: 139 }] },
        ],
      },
    },
  ]);
  const standings = await getDcuResults({ kind: "standings" }, { ...LOGIN, http: api, now: NOW });
  assert.equal(standings.divisions[0].riders[0].points, 139);
  assert.equal(standings.divisions[0].riders[0].counting[0].race, "DZR løbet");
  const clubs = await getDcuResults({ kind: "clubs" }, { ...LOGIN, http: api, now: NOW });
  assert.equal(clubs.clubs.find((row) => row.yours).rank, 2);
});
