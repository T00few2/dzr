/**
 * Stateless OpenAI Responses API adapter for DZR Coach.
 *
 * The Coach deliberately does not use previous_response_id or Conversations. Responses are sent
 * with store:false, and encrypted reasoning is replayed only inside the current tool loop. Once a
 * visible answer exists, callers keep that text and discard the opaque reasoning items.
 */
const { toResponseInputItems } = require("openai/lib/responses/ResponseInputItems");

const COACH_MODEL = process.env.COACH_MODEL || "gpt-6-luna";
const COACH_BASE_EFFORT = process.env.COACH_REASONING_EFFORT || "low";
const COACH_ANALYSIS_EFFORT = process.env.COACH_ANALYSIS_REASONING_EFFORT || "medium";
const DEFAULT_MAX_OUTPUT_TOKENS = 16000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 2000;

function errorInfo(error) {
  const code = error?.code || error?.error?.code || null;
  const type = error?.type || error?.error?.type || null;
  const message = error?.message || error?.error?.message || "";
  const status = error?.status ?? error?.statusCode ?? null;
  const quota =
    code === "insufficient_quota" ||
    type === "insufficient_quota" ||
    /quota|billing|payment|exceeded your current quota/i.test(message);
  return {
    code,
    type,
    message,
    status,
    looksLikeQuota: quota,
    looksLikeRateLimit: !quota && (code === "rate_limit_exceeded" || status === 429),
  };
}

/** Convert the Chat Completions tool declarations already used by Coach to Responses tools. */
function toResponsesTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((tool) => tool?.type === "function" && tool.function?.name)
    .map((tool) => ({
      type: "function",
      name: tool.function.name,
      description: tool.function.description || "",
      parameters: tool.function.parameters || { type: "object", properties: {} },
      // Preserve today's best-effort argument behaviour. Strict mode can be enabled separately
      // after every existing schema has additionalProperties:false and fully required fields.
      strict: false,
    }));
}

/** Convert the visible transcript. Tool/reasoning items are transient and never enter this list. */
function visibleMessagesToInput(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  return rows
    .filter((message) => ["user", "assistant"].includes(message?.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || ""),
    }));
}

/**
 * Put the concrete "say it once" constraint beside the current turn. Long-lived prompt rules are
 * easy for a model to overlook after tools; naming already-used numbers makes the general rule
 * deterministic without encoding cycling-specific facts.
 */
function repetitionGuardForVisibleHistory(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  const latestUser = [...rows].reverse().find((message) => message?.role === "user");
  const previousAssistant = [...rows].reverse().find((message) => message?.role === "assistant");
  if (!previousAssistant?.content) return "";
  const userText = String(latestUser?.content || "");
  const numbers = Array.from(new Set(
    (String(previousAssistant.content).match(/\b\d+(?:[.,]\d+)?\s*%?/g) || [])
      .map((value) => value.trim())
      .filter((value) => !userText.includes(value))
  )).slice(0, 20);
  if (!numbers.length) return "";
  return (
    "\n\n## This turn only\n" +
    `These numbers were already in your previous reply: ${numbers.join(", ")}. ` +
    "Do not include them again unless the athlete explicitly asks for them."
  );
}

function responseText(response) {
  if (typeof response?.output_text === "string") return response.output_text.trim();
  const chunks = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("").trim();
}

function responseRefusal(response) {
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type === "refusal" && typeof part.refusal === "string") return part.refusal.trim();
    }
  }
  return "";
}

function responseToolCalls(response) {
  return (response?.output || [])
    .filter((item) => item?.type === "function_call")
    .map((item) => ({
      id: item.call_id,
      call_id: item.call_id,
      name: item.name,
      arguments: item.arguments || "{}",
      // Compatibility shape for the existing executor while the handler migrates.
      function: { name: item.name, arguments: item.arguments || "{}" },
    }));
}

function replayableOutput(response) {
  return toResponseInputItems(Array.isArray(response?.output) ? response.output : []);
}

function configurationUpdate(effort) {
  return {
    type: "configuration_update",
    reasoning: { effort },
  };
}

function functionCallOutputs(results) {
  return (Array.isArray(results) ? results : []).map((result) => ({
    type: "function_call_output",
    call_id: result.tool_call_id || result.call_id,
    output: typeof result.output === "string" ? result.output : JSON.stringify(result.output ?? result),
  }));
}

async function createResponseWithRetry(client, params, {
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.responses.create(params);
    } catch (error) {
      const info = errorInfo(error);
      if (!info.looksLikeRateLimit || info.looksLikeQuota || attempt === maxRetries) throw error;
      const delay = retryDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }
  throw new Error("OpenAI retry loop ended unexpectedly.");
}

/**
 * One Responses API round. The caller owns the bounded tool loop and passes the accumulated input
 * back on later rounds, including replayableOutput() and function_call_output items.
 */
async function createCoachResponse(client, {
  instructions,
  input,
  tools,
  model = COACH_MODEL,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  reasoningEffort = COACH_BASE_EFFORT,
  cacheKey = "dzr-coach",
  allowTools = true,
  retry,
} = {}) {
  if (!client?.responses?.create) throw new Error("OpenAI Responses API client is unavailable.");
  const responseTools = allowTools ? toResponsesTools(tools) : [];
  const params = {
    model,
    instructions: String(instructions || ""),
    input: Array.isArray(input) ? input : [],
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort },
    store: false,
    include: ["reasoning.encrypted_content"],
    prompt_cache_key: cacheKey,
    ...(responseTools.length
      ? { tools: responseTools, tool_choice: "auto", parallel_tool_calls: true }
      : {}),
  };

  const startedAt = Date.now();
  const raw = await createResponseWithRetry(client, params, retry);
  const text = responseText(raw);
  const refusal = responseRefusal(raw);
  return {
    raw,
    id: raw.id || null,
    status: raw.status || null,
    incompleteReason: raw.incomplete_details?.reason || null,
    text: text || refusal,
    refusal,
    toolCalls: responseToolCalls(raw),
    outputItems: replayableOutput(raw),
    usage: raw.usage || null,
    latencyMs: Date.now() - startedAt,
    model: raw.model || model,
    request: params,
  };
}

module.exports = {
  COACH_MODEL,
  COACH_BASE_EFFORT,
  COACH_ANALYSIS_EFFORT,
  errorInfo,
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
};
