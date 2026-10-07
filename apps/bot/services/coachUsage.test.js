const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTokenUsage, budgetTokens, endsWithQuestion } = require("./coachUsage");

test("reads cached prompt tokens from chat completions usage", () => {
  const usage = extractTokenUsage({
    usage: { prompt_tokens: 10000, completion_tokens: 500, total_tokens: 10500, prompt_tokens_details: { cached_tokens: 8000 } },
  });
  assert.deepEqual(usage, {
    promptTokens: 10000, completionTokens: 500, totalTokens: 10500,
    cachedPromptTokens: 8000, cacheWriteTokens: 0, reasoningTokens: 0,
  });
});

test("treats missing usage and missing cache details as zero", () => {
  assert.deepEqual(extractTokenUsage({}), {
    promptTokens: 0, completionTokens: 0, totalTokens: 0,
    cachedPromptTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0,
  });
  assert.equal(extractTokenUsage({ usage: { prompt_tokens: 100, completion_tokens: 10 } }).cachedPromptTokens, 0);
});

test("never reports more cached tokens than prompt tokens", () => {
  const usage = extractTokenUsage({ usage: { prompt_tokens: 100, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 500 } } });
  assert.equal(usage.cachedPromptTokens, 100);
});

test("reads Responses cache writes and reasoning tokens", () => {
  assert.deepEqual(extractTokenUsage({
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
      total_tokens: 1200,
      input_tokens_details: { cached_tokens: 600, cache_write_tokens: 300 },
      output_tokens_details: { reasoning_tokens: 150 },
    },
  }), {
    promptTokens: 1000,
    completionTokens: 200,
    totalTokens: 1200,
    cachedPromptTokens: 600,
    cacheWriteTokens: 300,
    reasoningTokens: 150,
  });
});

test("a question in the closing paragraph counts as ending with a question", () => {
  assert.equal(endsWithQuestion("Kør roligt i morgen.\n\nHvordan har benene det?"), true);
  assert.equal(endsWithQuestion("Kør roligt i morgen. Hvordan har benene det? Skriv endelig."), true);
});

test("a question earlier in the reply does not count", () => {
  assert.equal(endsWithQuestion("Hvorfor var den tung? Du sov kun 5 timer.\n\nKør roligt i morgen."), false);
  assert.equal(endsWithQuestion(""), false);
});

test("cached prompt tokens count at a tenth against the budget", () => {
  assert.equal(budgetTokens({ totalTokens: 10500, cachedPromptTokens: 8000 }), 3300);
  assert.equal(budgetTokens({ totalTokens: 10500, cachedPromptTokens: 0 }), 10500);
  assert.equal(budgetTokens({}), 0);
});
