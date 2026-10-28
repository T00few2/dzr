const test = require("node:test");
const assert = require("node:assert/strict");
const { findRidersByName, buildRiderSearchReply, riderSelectOwner, isRiderSelect, resetRiderSearch } = require("./riderSearch");

const NOW = new Date("2026-10-28T12:00:00Z");

function deps({ club = [], zp = [], zpError = false } = {}) {
  const calls = { zp: [] };
  return {
    calls,
    searchClub: async () => club,
    searchZwiftPower: async (q) => { calls.zp.push(q); if (zpError) throw new Error("502"); return zp; },
    now: () => NOW,
  };
}

test("club riders come first, ZwiftPower riders follow without duplicates", async () => {
  resetRiderSearch();
  const d = deps({
    club: [{ name: "Christian Kjeldsen [DZR PP]", riderId: 2994337, zpCategory: "A" }],
    zp: [
      { zwiftId: 2994337, name: "Christian Kjeldsen [DZR PP]", country: "DK", category: "A", team: null },
      { zwiftId: 15690, name: "Christian Kjaer", country: "DK", category: "B", team: null },
    ],
  });
  const result = await findRidersByName("Christian Kj", { discordId: "u1" }, d);
  assert.deepEqual(result.riders.map((r) => [r.zwiftId, r.inClub]), [[2994337, true], [15690, false]]);
  assert.deepEqual(d.calls.zp, ["Christian Kj"]);
});

test("three letters search only the club; under three is too short", async () => {
  resetRiderSearch();
  const d = deps();
  assert.equal((await findRidersByName("Chr", {}, d)).riders.length, 0);
  assert.deepEqual(d.calls.zp, []);
  assert.equal((await findRidersByName("Ch", {}, d)).tooShort, true);
});

test("ZwiftPower results are cached and each member has a daily allowance", async () => {
  resetRiderSearch();
  const d = deps({ zp: [{ zwiftId: 1, name: "Anna Hansen" }] });
  await findRidersByName("Anna Hansen", { discordId: "u1" }, d);
  await findRidersByName("anna  hansen", { discordId: "u1" }, d);
  assert.equal(d.calls.zp.length, 1, "cached by folded query");
  for (let i = 0; i < 25; i++) await findRidersByName(`Anna ${i}xyz`, { discordId: "u2" }, d);
  const limited = await findRidersByName("Anna limited", { discordId: "u2" }, d);
  assert.equal(limited.zpLimited, true);
});

test("a ZwiftPower error is reported, not shown as no riders", async () => {
  resetRiderSearch();
  const result = await findRidersByName("Bjarne Riis", { discordId: "u1" }, deps({ zpError: true }));
  assert.equal(result.zpError, true);
  assert.match(buildRiderSearchReply("u1", "Bjarne Riis", result).content, /ZwiftPower svarede ikke/);
});

test("the menu is bound to the member who searched and shows flag, ID and category", async () => {
  resetRiderSearch();
  const result = await findRidersByName("Christian Kj", { discordId: "u1" }, deps({ zp: [{ zwiftId: 15690, name: "Christian Kjaer", country: "DK", category: "B" }] }));
  const reply = buildRiderSearchReply("u1", "Christian Kj", result);
  const menu = reply.components[0].components[0].data;
  assert.equal(menu.custom_id, "myzwift_select:u1");
  const [option] = reply.components[0].components[0].options.map((o) => o.data);
  assert.equal(option.label, "🇩🇰 Christian Kjaer");
  assert.equal(option.description, "ZwiftID 15690 · DK · kat. B");
  assert.equal(option.value, "15690");
  assert.equal(riderSelectOwner(menu.custom_id), "u1");
  assert.equal(riderSelectOwner("myzwift_select"), null);
  assert.equal(isRiderSelect("myzwift_select"), true);
  assert.equal(isRiderSelect("setzwift_select_1"), false);
});

test("no hits explain how to be found", () => {
  const reply = buildRiderSearchReply("u1", "Nobody Here", { riders: [] });
  assert.match(reply.content, /zwiftpower\.com/);
  assert.equal(reply.components, undefined);
});
