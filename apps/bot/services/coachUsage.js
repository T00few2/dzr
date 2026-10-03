/**
 * Token accounting for the coach: what an OpenAI response used, and how much of it counts
 * against the athlete's daily budget.
 *
 * Pure, so it can be unit tested without Firebase.
 */

// OpenAI bills cached prompt tokens at about a tenth of normal input. The prompt puts fixed rules
// first so most of it is cached; counting those tokens in full would cut athletes off long before
// the money the budget is meant to protect has been spent.
const CACHED_PROMPT_WEIGHT = 0.1;

function extractTokenUsage(response) {
  const u = response?.usage || {};
  const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const totalTokens = Number(u.total_tokens ?? 0) || promptTokens + completionTokens;
  const cachedRaw = Number(
    u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0
  ) || 0;
  const cachedPromptTokens = Math.min(Math.max(0, cachedRaw), promptTokens);
  return { promptTokens, completionTokens, totalTokens, cachedPromptTokens };
}

/** Tokens charged to the daily budget: total, with cached prompt tokens at a discount. */
function budgetTokens({ totalTokens = 0, cachedPromptTokens = 0 } = {}) {
  const total = Math.max(0, Number(totalTokens) || 0);
  const cached = Math.min(total, Math.max(0, Number(cachedPromptTokens) || 0));
  return Math.round(total - cached * (1 - CACHED_PROMPT_WEIGHT));
}

module.exports = { CACHED_PROMPT_WEIGHT, extractTokenUsage, budgetTokens };
