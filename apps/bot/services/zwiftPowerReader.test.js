const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getRiderRaces,
  compactRiderProfile,
  compactTeamResults,
  clearCache,
} = require("./zwiftPowerReader");

test("compacts a rider profile, newest race first, unwrapping [value, flag] pairs", () => {
  const rider = compactRiderProfile({
    data: [
      { event_title: "Old race", event_date: 1700000000, category: "C", name: "Chris", tname: "DZR", position_in_cat: 9 },
      {
        event_title: "DZR After Party &amp; Friends",
        event_date: 1760000000,
        category: "B",
        name: "Chris",
        tname: "DZR",
        position_in_cat: 3,
        avg_wkg: ["3.41", 0],
        wkg1200: ["3.6", 0],
        ftp: "265",
        weight: ["78.0", 0],
      },
    ],
  }, { limit: 1 });

  assert.equal(rider.latest_category, "B");
  assert.equal(rider.ftp_watts, 265);
  assert.equal(rider.races_on_record, 2);
  assert.equal(rider.recent_races.length, 1);
  assert.equal(rider.recent_races[0].event, "DZR After Party & Friends");
  assert.equal(rider.recent_races[0].avg_wkg, 3.41);
  assert.equal(rider.recent_races[0].position_in_category, 3);
});

test("returns null for an empty profile", () => {
  assert.equal(compactRiderProfile({ data: [] }), null);
  assert.equal(compactRiderProfile({}), null);
});

test("groups team results by event within the window and filters on title", () => {
  const now = Date.UTC(2026, 9, 20);
  const day = 24 * 60 * 60;
  const payload = {
    events: {
      1: { title: "ZRL Race 3", date: now / 1000 - 2 * day },
      2: { title: "Club Ride", date: now / 1000 - 3 * day },
      3: { title: "ZRL Race 1", date: now / 1000 - 40 * day },
    },
    data: [
      { zid: "1", name: "B rider", category: "B", position_in_cat: 5 },
      { zid: "1", name: "A rider", category: "A", position_in_cat: 2 },
      { zid: "2", name: "Social", category: "C", position_in_cat: 1 },
      { zid: "3", name: "Old", category: "B", position_in_cat: 1 },
    ],
  };

  const events = compactTeamResults(payload, { days: 7, title: "zrl", now });
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "ZRL Race 3");
  assert.equal(events[0].dzr_riders, 2);
  assert.deepEqual(events[0].results.map((r) => r.name), ["A rider", "B rider"]);

  assert.equal(compactTeamResults(payload, { days: 7, now }).length, 2);
});

test("caches API reads and only calls the read-only rider route", async () => {
  clearCache();
  const urls = [];
  const http = {
    get: async (url) => {
      urls.push(url);
      return { data: { data: [{ event_title: "R", event_date: 1760000000, category: "B" }] } };
    },
  };
  assert.equal((await getRiderRaces("123", { http })).success, true);
  assert.equal((await getRiderRaces(123, { http })).success, true);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/rider_data\/123$/);
  assert.equal((await getRiderRaces("abc", { http })).success, false);
  clearCache();
});
