const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseFulfillment,
  partitionByFulfillment,
  unmetToolOutput,
  fulfillmentUserContent,
  recentConversation,
} = require("./toolFulfillment");

test("parseFulfillment reads a boolean and fails open on anything else", () => {
  assert.equal(parseFulfillment('{"fulfills": false}'), false);
  assert.equal(parseFulfillment('{"fulfills": true, "note": "stats"}'), true);
  assert.equal(parseFulfillment('```json\n{"fulfills": false}\n```'), false);
  assert.equal(parseFulfillment('{"fulfills": "false"}'), false);
  assert.equal(parseFulfillment("I think so"), null);
  assert.equal(parseFulfillment(""), null);
  assert.equal(parseFulfillment("{not json"), null);
});

test("only an explicit false blocks a tool call", () => {
  const calls = [
    { id: "1", name: "whoami" },
    { id: "2", name: "rider_stats" },
    { id: "3", name: "zrl_category" },
  ];
  const verdicts = new Map([
    ["1", false],
    ["2", null],
    ["3", true],
  ]);
  const result = partitionByFulfillment(calls, verdicts);
  assert.deepEqual(result.accepted.map((call) => call.name), ["rider_stats", "zrl_category"]);
  assert.deepEqual(result.rejected.map((call) => call.name), ["whoami"]);
  assert.deepEqual(result.newlyRejected, ["whoami"]);
});

test("a repeated rejection is expressed as a tool result, not a user-facing reply", () => {
  const output = JSON.parse(unmetToolOutput("whoami", "Return only the ZwiftID number."));
  assert.equal(output.executed, false);
  assert.equal(output.success, false);
  assert.match(output.message, /whoami/);
  assert.match(output.message, /nothing was shown/);
});

test("the check is given the user text and the tool's own description", () => {
  const content = fulfillmentUserContent({
    userText: "giv mig lige mine forfærdelige stats",
    name: "whoami",
    description: "Return only the ZwiftID number.",
    args: "{}",
  });
  assert.match(content, /forfærdelige stats/);
  assert.match(content, /whoami/);
  assert.match(content, /ZwiftID number/);
});

test("a follow-up is judged with the messages before it", () => {
  const input = [
    { role: "user", content: "hvad er min zwift id?" },
    { role: "assistant", content: "Din ZwiftID er 123." },
    { role: "user", content: "hvordan gik det i DZR løbet i aften i DCU E-serien?" },
    { role: "assistant", content: "Det gik stærkt for DZR i aften. ".repeat(40) },
    { role: "user", content: "Kan du liste alle DZR resultater?" },
    { type: "function_call", name: "dcu_eserien_results", arguments: "{}" },
  ];
  const context = recentConversation(input);
  assert.match(context, /^user: hvordan gik det i DZR løbet i aften i DCU E-serien\?/);
  assert.match(context, /\nassistant: Det gik stærkt/);
  assert.doesNotMatch(context, /ZwiftID/);
  assert.doesNotMatch(context, /Kan du liste/);
  assert.ok(context.length < 800);

  const content = fulfillmentUserContent({
    userText: "Kan du liste alle DZR resultater?",
    name: "dcu_eserien_results",
    description: "Danish Zwift Racers' results in DCU E-serien.",
    args: "{}",
    context,
  });
  assert.ok(content.indexOf("DCU E-serien?") < content.indexOf("User message:"));
  assert.equal(recentConversation([{ role: "user", content: "hej" }]), "");
  assert.doesNotMatch(fulfillmentUserContent({ userText: "hej", name: "x", description: "y", args: "{}" }), /Recent conversation/);
});
