const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseFulfillment,
  partitionByFulfillment,
  unmetToolOutput,
  fulfillmentUserContent,
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
