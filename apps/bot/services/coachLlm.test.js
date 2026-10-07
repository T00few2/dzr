const test = require("node:test");
const assert = require("node:assert/strict");

const {
  toResponsesTools,
  visibleMessagesToInput,
  repetitionGuardForVisibleHistory,
  responseText,
  responseRefusal,
  responseToolCalls,
  replayableOutput,
  configurationUpdate,
  functionCallOutputs,
  createResponseWithRetry,
  createCoachResponse,
} = require("./coachLlm");

test("flattens existing function tools without silently enabling strict schemas", () => {
  const [tool] = toResponsesTools([{
    type: "function",
    function: {
      name: "get_ride",
      description: "Fetch a ride",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  }]);
  assert.equal(tool.name, "get_ride");
  assert.equal(tool.strict, false);
  assert.equal(tool.parameters.required[0], "id");
  assert.equal("function" in tool, false);
});

test("visible history excludes system and never contains transient tool state", () => {
  assert.deepEqual(visibleMessagesToInput([
    { role: "system", content: "rules" },
    { role: "user", content: "hej" },
    { role: "assistant", content: "hej igen" },
    { role: "tool", content: "private result" },
  ]), [
    { role: "user", content: "hej" },
    { role: "assistant", content: "hej igen" },
  ]);
});

test("the turn guard names old numbers unless the athlete asks for one again", () => {
  const guard = repetitionGuardForVisibleHistory([
    { role: "assistant", content: "NP 245 W over 62 min og 3,1 % drift." },
    { role: "user", content: "Kan jeg så køre hårdt i dag?" },
  ]);
  assert.match(guard, /245/);
  assert.match(guard, /62/);
  assert.match(guard, /3,1\s*%/);

  const asked = repetitionGuardForVisibleHistory([
    { role: "assistant", content: "NP 245 W over 62 min." },
    { role: "user", content: "Hvad betyder de 245 W?" },
  ]);
  assert.doesNotMatch(asked, /245/);
  assert.match(asked, /62/);
});

test("reads output text, refusals and parallel function calls", () => {
  const response = {
    output: [
      { type: "reasoning", id: "r1", encrypted_content: "opaque", summary: [] },
      { type: "function_call", id: "fc1", call_id: "call1", name: "get_a", arguments: "{\"id\":1}" },
      { type: "function_call", id: "fc2", call_id: "call2", name: "get_b", arguments: "{}" },
      { type: "message", id: "m1", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Svar", annotations: [] }] },
    ],
  };
  assert.equal(responseText(response), "Svar");
  assert.equal(responseToolCalls(response).length, 2);
  assert.equal(responseToolCalls(response)[0].function.name, "get_a");
  assert.equal(replayableOutput(response).some((item) => item.type === "reasoning"), true);

  const refused = { output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] };
  assert.equal(responseRefusal(refused), "No");
});

test("builds configuration and function output items with original call ids", () => {
  assert.deepEqual(configurationUpdate("medium"), {
    type: "configuration_update",
    reasoning: { effort: "medium" },
  });
  assert.deepEqual(functionCallOutputs([
    { tool_call_id: "call1", output: { success: true } },
  ]), [{
    type: "function_call_output",
    call_id: "call1",
    output: "{\"success\":true}",
  }]);
});

test("Responses calls are stateless, cacheable and support parallel tools", async () => {
  let captured;
  const client = {
    responses: {
      create: async (params) => {
        captured = params;
        return {
          id: "resp1",
          model: "gpt-6-luna",
          status: "completed",
          output_text: "Kort svar",
          output: [],
          usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
        };
      },
    },
  };
  const result = await createCoachResponse(client, {
    instructions: "rules",
    input: [{ role: "user", content: "question" }],
    tools: [{ type: "function", function: { name: "get_data", parameters: { type: "object", properties: {} } } }],
    cacheKey: "dzr-coach:notes-on",
  });
  assert.equal(result.text, "Kort svar");
  assert.equal(captured.store, false);
  assert.deepEqual(captured.include, ["reasoning.encrypted_content"]);
  assert.equal(captured.parallel_tool_calls, true);
  assert.equal(captured.prompt_cache_key, "dzr-coach:notes-on");
  assert.equal(captured.reasoning.effort, "low");
  assert.equal(captured.tools[0].name, "get_data");
});

test("transient rate limits retry, quota failures do not", async () => {
  let attempts = 0;
  const client = {
    responses: {
      create: async () => {
        attempts++;
        if (attempts === 1) throw { status: 429, code: "rate_limit_exceeded" };
        return { output: [] };
      },
    },
  };
  const sleeps = [];
  await createResponseWithRetry(client, {}, {
    retryDelayMs: 5,
    sleep: async (ms) => sleeps.push(ms),
  });
  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [5]);

  await assert.rejects(
    createResponseWithRetry({
      responses: { create: async () => { throw { status: 429, code: "insufficient_quota" }; } },
    }, {}, { sleep: async () => undefined }),
  );
});
