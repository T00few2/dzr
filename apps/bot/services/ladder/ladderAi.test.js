const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLadderAiMessage, buildPrompt, takeRun, resetAiState } = require("./ladderAi");

function riders(prefix, base) {
  return [0, 1, 2].map((i) => ({
    name: `${prefix} ${i} [DZR]`,
    zrs: 600 + i * 50,
    category: "B",
    form: 90 + i,
    wkg: { 15: base + 8, 60: base + 3, 120: base + 1.5, 300: base + i * 0.1, 1200: base - 0.8 },
  }));
}

const fixture = {
  id: "17372",
  start: "2026-10-21T17:30:00Z",
  route: "Greater London Loop",
  world: "London",
  laps: 1,
  distance: null,
  powerups: ["AERO", "BURRITO"],
  colors: { home: "#213ed6", away: "#ff0000" },
  home: { name: "Coalition Taraxyl", riders: riders("Modstander", 4.4) },
  away: { name: "A whole lot of Danes", riders: riders("Vores", 4.6) },
};

const noEnrich = async () => {};
const noInfo = async () => null;

test("the prompt puts our team first and carries route, powerups and rider tables", () => {
  const info = { distKm: 21.5, elevM: 252, kind: "Let kuperet" };
  const prompt = buildPrompt(fixture, fixture.away, fixture.home, info);
  assert.match(prompt, /Vi er "A whole lot of Danes", modstanderen er "Coalition Taraxyl"/);
  assert.match(prompt, /Rute: Greater London Loop \(London\), 21\.5 km, 252 hm \(let kuperet\), 1 omgange/);
  assert.match(prompt, /Powerups: AERO, BURRITO/);
  assert.match(prompt, /Vores 0/);
  assert.match(prompt, /snit \d\.\d\d, top 3 \d\.\d\d/);
});

test("builds an embed from the generated text and reuses it from the cache", async () => {
  resetAiState();
  let calls = 0;
  const generate = async () => {
    calls += 1;
    return "1. **Overordnet vurdering** Vi er stærkere.";
  };
  const first = await buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u1", generate, enrich: noEnrich, loadInfo: noInfo });
  const second = await buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u2", generate, enrich: noEnrich, loadInfo: noInfo });
  assert.equal(calls, 1);
  const json = first.embeds[0].toJSON();
  assert.equal(json.title, "AI-analyse: A whole lot of Danes mod Coalition Taraxyl");
  assert.match(json.description, /Vi er stærkere/);
  assert.equal(second.embeds[0].toJSON().description, json.description);
});

test("a cached analysis does not use up the daily limit, a fresh one does", async () => {
  resetAiState();
  const now = Date.parse("2026-10-21T10:00:00Z");
  const generate = async () => "tekst";
  const other = { ...fixture, id: "999" };
  await buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u3", generate, enrich: noEnrich, loadInfo: noInfo, now });
  await buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u3", generate, enrich: noEnrich, loadInfo: noInfo, now: now + 1000 });
  let used = 1;
  while (takeRun("u3", now)) used += 1;
  assert.equal(used, 5);
  await assert.rejects(
    buildLadderAiMessage(other, "A whole lot of Danes", { userId: "u3", generate, enrich: noEnrich, loadInfo: noInfo, now }),
    /AI-analyser i dag/
  );
});

test("an empty answer is reported instead of posted", async () => {
  resetAiState();
  await assert.rejects(
    buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u4", generate: async () => "  ", enrich: noEnrich, loadInfo: noInfo }),
    (err) => /gav intet svar/.test(err.userMessage)
  );
});

test("long answers are cut to fit a Discord embed", async () => {
  resetAiState();
  const message = await buildLadderAiMessage(fixture, "A whole lot of Danes", { userId: "u5", generate: async () => "x".repeat(6000), enrich: noEnrich, loadInfo: noInfo });
  assert.ok(message.embeds[0].toJSON().description.length <= 4100);
});
