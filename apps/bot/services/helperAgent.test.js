const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_ROUNDS,
  MAX_ZP_CALLS_PER_RUN,
  runHelper,
  executeHelperTool,
  knowledgeMatches,
  responseCitations,
  takeDailyRun,
  resetDailyRuns,
} = require("./helperAgent");

function fakeDeps(overrides = {}) {
  const logged = [];
  const riderCalls = [];
  return {
    logged,
    riderCalls,
    getUserZwiftId: async () => "111",
    getLatestClubStats: async () => ({ riders: [{ riderId: 222, name: "Anders Andersen", zpCategory: "B" }] }),
    getAllBotKnowledge: async () => [{ key: "zrl", title: "ZRL tilmelding", content: "Sådan tilmelder du dig ZRL.", tags: ["zrl"] }],
    recordHelperRun: async (run) => logged.push(run),
    getRiderRaces: async (id) => {
      riderCalls.push(id);
      return { success: true, zwift_id: Number(id), rider: { name: "x", recent_races: [] } };
    },
    getClubResults: async () => ({ success: true, events: [] }),
    ...overrides,
  };
}

function run(asker = { discordId: "d1", source: "club" }) {
  return { asker, zpCalls: 0, zpLookups: [], zpRefused: [], toolNames: [], rounds: 0, tokens: 0 };
}

function fnCall(name, args, id = `c-${name}`) {
  return { type: "function_call", call_id: id, name, arguments: JSON.stringify(args) };
}

function textMessage(text, annotations = []) {
  return { type: "message", role: "assistant", content: [{ type: "output_text", text, annotations }] };
}

/** An OpenAI client that replays scripted outputs and records every request. */
function scriptedClient(outputs) {
  const requests = [];
  return {
    requests,
    responses: {
      create: async (params) => {
        requests.push(JSON.parse(JSON.stringify(params)));
        const output = outputs[Math.min(requests.length - 1, outputs.length - 1)];
        return { id: `r${requests.length}`, status: "completed", output, usage: { input_tokens: 10, output_tokens: 5 } };
      },
    },
  };
}

test("looks up the asking member's own Zwift ID with 'me'", async () => {
  const deps = fakeDeps();
  const state = run();
  const result = await executeHelperTool({ name: "zp_rider_races", arguments: '{"zwift_id":"me"}' }, state, deps);
  assert.equal(result.success, true);
  assert.deepEqual(deps.riderCalls, ["111"]);
  assert.deepEqual(state.zpLookups, ["111"]);
});

test("allows club riders and refuses anyone outside the club", async () => {
  const deps = fakeDeps();
  const state = run();
  assert.equal((await executeHelperTool({ name: "zp_rider_races", arguments: '{"zwift_id":"222"}' }, state, deps)).success, true);
  const refused = await executeHelperTool({ name: "zp_rider_races", arguments: '{"zwift_id":"999"}' }, state, deps);
  assert.equal(refused.success, false);
  assert.deepEqual(deps.riderCalls, ["222"]);
  assert.deepEqual(state.zpRefused, ["999"]);
});

test("rejects a Zwift ID that is not a number, so no URL can be smuggled in", async () => {
  const deps = fakeDeps();
  const result = await executeHelperTool({ name: "zp_rider_races", arguments: '{"zwift_id":"222/../../admin"}' }, run(), deps);
  assert.equal(result.success, false);
  assert.equal(deps.riderCalls.length, 0);
});

test("caps ZwiftPower calls per run", async () => {
  const deps = fakeDeps();
  const state = run();
  for (let i = 0; i < MAX_ZP_CALLS_PER_RUN; i++) {
    assert.equal((await executeHelperTool({ name: "zp_club_results", arguments: "{}" }, state, deps)).success, true);
  }
  const over = await executeHelperTool({ name: "zp_rider_races", arguments: '{"zwift_id":"222"}' }, state, deps);
  assert.equal(over.success, false);
  assert.equal(deps.riderCalls.length, 0);
});

test("finds club riders by partial name", async () => {
  const result = await executeHelperTool({ name: "find_club_rider", arguments: '{"name":"anders"}' }, run(), fakeDeps());
  assert.deepEqual(result.riders, [{ name: "Anders Andersen", zwift_id: "222", pace_category: "B" }]);
});

test("knowledge search scores keywords and ignores short words", () => {
  const entries = [
    { key: "zrl", title: "ZRL tilmelding", content: "", tags: [] },
    { key: "shop", title: "Klubtøj", content: "Bestil trøjer", tags: [] },
  ];
  assert.equal(knowledgeMatches(entries, "hvordan zrl")[0].key, "zrl");
  assert.deepEqual(knowledgeMatches(entries, "a b"), []);
});

test("collects url citations once each", () => {
  const raw = { output: [textMessage("x", [
    { type: "url_citation", url: "https://zwift.com/a", title: "A" },
    { type: "url_citation", url: "https://zwift.com/a", title: "A" },
    { type: "file_citation", file_id: "f" },
  ])] };
  assert.deepEqual(responseCitations(raw), [{ title: "A", url: "https://zwift.com/a" }]);
});

test("daily run cap", () => {
  resetDailyRuns();
  const now = new Date("2026-10-20T10:00:00Z");
  assert.equal(takeDailyRun("u", now, 2), true);
  assert.equal(takeDailyRun("u", now, 2), true);
  assert.equal(takeDailyRun("u", now, 2), false);
  assert.equal(takeDailyRun("u", new Date("2026-10-21T10:00:00Z"), 2), true);
  resetDailyRuns();
});

test("runs tools, answers with sources, and logs the run", async () => {
  resetDailyRuns();
  const client = scriptedClient([
    [fnCall("zp_rider_races", { zwift_id: "me" })],
    [textMessage("Du kørte B sidst.", [{ type: "url_citation", url: "https://zwiftpower.com", title: "ZP" }])],
  ]);
  const deps = fakeDeps();
  const responses = [];
  const result = await runHelper({
    openai: client,
    question: "Hvilken kategori kørte jeg sidst?",
    asker: { discordId: "d1", username: "chris", source: "club" },
    onResponse: (r) => responses.push(r),
  }, deps);

  assert.equal(result.success, true);
  assert.equal(result.answer, "Du kørte B sidst.");
  assert.deepEqual(result.sources, [{ title: "ZP", url: "https://zwiftpower.com" }]);
  assert.equal(responses.length, 2);
  // Web search is offered next to the function tools, and the tool output went back in.
  assert.ok(client.requests[0].tools.some((t) => t.type === "web_search"));
  assert.ok(client.requests[1].input.some((item) => item.type === "function_call_output" && item.call_id === "c-zp_rider_races"));
  assert.equal(deps.logged.length, 1);
  assert.equal(deps.logged[0].outcome, "answered");
  assert.deepEqual(deps.logged[0].zpLookups, ["111"]);
  assert.equal(deps.logged[0].question, "Hvilken kategori kørte jeg sidst?");
});

test("stops after the round limit and answers every pending call before forcing an answer", async () => {
  resetDailyRuns();
  const outputs = [];
  for (let i = 0; i <= MAX_ROUNDS; i++) outputs.push([fnCall("search_club_knowledge", { query: "zrl" }, `c${i}`)]);
  outputs.push([textMessage("Final.")]);
  const client = scriptedClient(outputs);
  const result = await runHelper({ openai: client, question: "q", asker: { discordId: "d2", source: "club" } }, fakeDeps());

  assert.equal(result.answer, "Final.");
  const last = client.requests.at(-1);
  assert.equal(last.tools, undefined);
  const calls = last.input.filter((item) => item.type === "function_call").map((item) => item.call_id);
  const outputsFor = new Set(last.input.filter((item) => item.type === "function_call_output").map((item) => item.call_id));
  assert.ok(calls.every((id) => outputsFor.has(id)));
});

test("does not log what a coach athlete asked", async () => {
  resetDailyRuns();
  const deps = fakeDeps();
  await runHelper({
    openai: scriptedClient([[textMessage("ok")]]),
    question: "mit knæ gør ondt",
    asker: { discordId: "d3", source: "coach" },
  }, deps);
  assert.equal(deps.logged[0].question, null);
});

test("never throws when the model call fails", async () => {
  resetDailyRuns();
  const deps = fakeDeps();
  const broken = { responses: { create: async () => { throw new Error("boom"); } } };
  const result = await runHelper({ openai: broken, question: "q", asker: { discordId: "d4" } }, deps);
  assert.equal(result.success, false);
  assert.equal(deps.logged[0].outcome, "error");
});
