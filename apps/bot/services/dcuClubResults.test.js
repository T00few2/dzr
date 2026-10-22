const test = require("node:test");
const assert = require("node:assert/strict");

const { getDcuResults, resetCache, formatFinish, CLUB_API_BASE } = require("./dcuClubResults");

const LOGIN = { username: "dzr", secret: "test-secret" };
const NOW = Date.parse("2026-10-22T20:30:00Z");

const INDEX = {
  races: [
    { id: "eckd1", name: "eCKD løbet", date: "2026-09-17T19:00:00+00:00", resultsPhase: "finalized", stageRaceName: "eCKD" },
    { id: "dzr1", name: "DZR løbet", date: "2026-10-22T19:00:00+00:00", resultsPhase: "finalized", stageRaceName: "DZR" },
  ],
};

const DZR_RESULTS = {
  id: "dzr1",
  name: "DZR løbet",
  date: "2026-10-22T19:00:00+00:00",
  resultsPhase: "finalized",
  stageRaceName: "DZR",
  divisions: [
    {
      category: "1. Division",
      fieldSize: 21,
      riders: [
        { position: 10, name: "Emil Ringgaard", finishTime: 3918590, finishPoints: 118, sprintPoints: 6, totalPoints: 124, raceStatus: "FIN" },
      ],
    },
    {
      category: "2. Division",
      fieldSize: 62,
      riders: [
        { position: 1, name: "Jacob Stauner", finishTime: 4062211, finishPoints: 117, sprintPoints: 22, totalPoints: 139, raceStatus: "FIN" },
        { position: 58, name: "Kim Damgaard", finishTime: 0, finishPoints: 0, sprintPoints: 0, totalPoints: 0, raceStatus: "DNF" },
      ],
    },
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
  return http([
    { match: "/club-api/races/dzr1/results", data: DZR_RESULTS },
    { match: "/club-api/races", data: INDEX },
    ...extra,
  ]);
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
  assert.equal(result.divisions[1].riders[0].sprint_points, 22);
  assert.equal(result.divisions[1].riders[0].status, undefined);
  assert.equal(result.divisions[1].riders[1].time, undefined);
  assert.equal(result.divisions[1].riders[1].sprint_points, undefined);
  assert.equal(result.divisions[1].riders[1].status, "DNF");
  assert.equal(api.calls[0].url, `${CLUB_API_BASE}/club-api/races`);
  assert.equal(api.calls[1].url, `${CLUB_API_BASE}/club-api/races/dzr1/results`);
  assert.equal(Buffer.from(api.calls[0].authorization.replace("Basic ", ""), "base64").toString("utf8"), "dzr:test-secret");
});

test("finds DZR løbet and can filter to one rider", async () => {
  resetCache();
  const result = await getDcuResults({ query: "DZR løbet", rider: "Emil" }, { ...LOGIN, http: client(), now: NOW });
  assert.equal(result.name, "DZR løbet");
  assert.deepEqual(result.divisions.map((row) => row.riders.map((rider) => rider.name)), [["Emil Ringgaard"]]);
  assert.equal(result.divisions[0].field_size, 21);
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
      match: "/club-api/races",
      data: {
        races: [
          { id: "dzr1", name: "DZR løbet", date: "2026-10-22T19:00:00+00:00", resultsPhase: "finalized" },
          { id: "dzr2", name: "DZR finale", date: "2026-11-19T19:00:00+00:00", resultsPhase: "provisional" },
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
  assert.equal(api.calls.length, 2);
});

test("reports a missing login, a rejected login, and a failed request", async () => {
  resetCache();
  assert.equal((await getDcuResults({}, { username: "", secret: "", http: client(), now: NOW })).success, false);
  resetCache();
  const rejected = await getDcuResults({}, { ...LOGIN, http: http([{ match: "/club-api/races", status: 401, data: {} }]), now: NOW });
  assert.equal(rejected.success, false);
  assert.match(rejected.message, /rejected/);
  resetCache();
  const down = await getDcuResults({}, { ...LOGIN, http: http([{ match: "/club-api/races", throw: true }]), now: NOW });
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
