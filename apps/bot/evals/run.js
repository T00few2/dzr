#!/usr/bin/env node
/**
 * Golden-set eval for the coach prompt.
 *
 *   node evals/run.js --dry-run   # build every prompt, assert structure, no API calls, free
 *   node evals/run.js             # also ask the model and judge the replies (costs tokens)
 *   node evals/run.js --only=word # run fixtures whose name contains "word"
 *
 * Deliberately NOT in CI. It costs money and, being model output, it is not perfectly
 * deterministic — a flaky suite wired into CI is one people learn to ignore, which is worse than
 * no suite. Run it before and after a prompt change.
 *
 * The model gets the real coach tools. Tool calls are answered from the fixture's canned
 * `toolResults` (anything not listed comes back as unavailable), so tool choice and what the
 * coach claims after a tool are tested, not just the prompt text.
 *
 * Judgements are made by a model against the fixture's stated expectation rather than by string
 * matching, because the behaviours here ("does not claim the goal is saved") have many valid
 * phrasings and one wrong one.
 */
const { buildCoachPromptText } = require("../services/coachPrompt");
const { formatCoachToday } = require("../services/coachChatNotes");
const { coachToolsFor, coachToolsForTurn, reasoningEffortAfterTools } = require("../services/coachTools");
const { extractTokenUsage } = require("../services/coachUsage");
const {
  COACH_ANALYSIS_EFFORT,
  createCoachResponse,
  visibleMessagesToInput,
  repetitionGuardForVisibleHistory,
  configurationUpdate,
  functionCallOutputs,
} = require("../services/coachLlm");
const { fixtures } = require("./fixtures");

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length);
const MODEL = process.env.COACH_EVAL_MODEL || "gpt-5-mini";
const JUDGE_MODEL = process.env.COACH_EVAL_JUDGE_MODEL || "gpt-6.1-sol";
const BASE_EFFORT = process.env.COACH_EVAL_EFFORT || "low";
const REPEATS = Math.min(5, Math.max(1, Number.parseInt(process.env.COACH_EVAL_REPEATS || "1", 10) || 1));
// Set COACH_EVAL_ROUTING=off to compare against the old flat effort.
const ROUTING = process.env.COACH_EVAL_ROUTING !== "off";
const MAX_TOOL_ROUNDS = 4;
const NOW = new Date("2026-09-06T12:00:00Z");

function buildPrompt(fixture) {
  return buildCoachPromptText({
    today: formatCoachToday(NOW),
    ...fixture.context,
  });
}

function toolNamesFor(fixture) {
  return new Set(coachToolsFor(Boolean(fixture.context.notesOptIn)).map((t) => t.function.name));
}

/** Structural checks that need no model and therefore no budget. */
function checkPromptStructure(prompt, fixture) {
  const problems = [];
  const required = [
    "## Today", "## Sport", "## Training load", "## Coach settings",
    "## Active goals", "## Calendar", "## Chat notes", "## Illness and injury",
    "## Reply shape", "## Current context",
  ];
  for (const heading of required) {
    if (!prompt.includes(heading)) problems.push(`missing section ${heading}`);
  }
  if (prompt.includes("undefined")) problems.push("prompt contains the literal 'undefined'");
  if (prompt.includes("[object Object]")) problems.push("prompt contains '[object Object]'");
  if (fixture.context.notesOptIn && !prompt.includes(fixture.context.goalsBlock)) {
    problems.push("goals block not interpolated");
  }
  const offered = toolNamesFor(fixture);
  for (const name of [...(fixture.expectTools || []), ...Object.keys(fixture.toolResults || {})]) {
    if (!offered.has(name)) problems.push(`fixture refers to tool ${name}, which is not offered here`);
  }
  for (const msg of fixture.history || []) {
    if (!["user", "assistant"].includes(msg.role) || typeof msg.content !== "string") {
      problems.push("history entries must be { role: user|assistant, content: string }");
      break;
    }
  }
  return problems;
}

function cannedToolResult(fixture, name) {
  const canned = fixture.toolResults?.[name];
  if (canned) return { success: true, ...canned };
  return { success: false, message: "Not available in this conversation." };
}

/** Run one coach turn against canned tool results. Returns the reply and the tools it called. */
async function runTurn(openai, fixture, prompt) {
  const tools = coachToolsForTurn(Boolean(fixture.context.notesOptIn), {
    calendarBlock: fixture.context.calendarBlock,
    userText: fixture.message,
  });
  const visibleMessages = [
    { role: "system", content: prompt },
    ...(fixture.history || []),
    { role: "user", content: fixture.message },
  ];
  const input = visibleMessagesToInput(visibleMessages);
  const instructions = prompt + repetitionGuardForVisibleHistory(visibleMessages);
  const called = [];
  let effort = BASE_EFFORT;
  let requestEffort = BASE_EFFORT;
  const metrics = { input: 0, output: 0, cached: 0, reasoning: 0, latencyMs: 0, calls: 0 };

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await createCoachResponse(openai, {
      instructions,
      input,
      tools,
      model: MODEL,
      maxOutputTokens: 16000,
      reasoningEffort: requestEffort,
      cacheKey: `dzr-coach-eval:${fixture.context.notesOptIn ? "notes-on" : "notes-off"}`,
      allowTools: round < MAX_TOOL_ROUNDS,
    });
    const usage = extractTokenUsage(response);
    metrics.input += usage.promptTokens;
    metrics.output += usage.completionTokens;
    metrics.cached += usage.cachedPromptTokens;
    metrics.reasoning += usage.reasoningTokens;
    metrics.latencyMs += response.latencyMs;
    metrics.calls += 1;
    input.push(...response.outputItems);
    if (!response.toolCalls.length) return { reply: response.text || "", called, metrics };
    if (round >= MAX_TOOL_ROUNDS) return { reply: response.text || "", called, metrics };

    const outputs = [];
    for (const call of response.toolCalls) {
      called.push(call.name);
      outputs.push({
        tool_call_id: call.call_id,
        output: cannedToolResult(fixture, call.name),
      });
    }
    if (ROUTING) {
      const routed = reasoningEffortAfterTools(called, BASE_EFFORT);
      const nextEffort = routed === BASE_EFFORT ? BASE_EFFORT : COACH_ANALYSIS_EFFORT;
      if (nextEffort !== effort) {
        if (MODEL.startsWith("gpt-6")) input.push(configurationUpdate(nextEffort));
        else requestEffort = nextEffort;
        effort = nextEffort;
      }
    }
    input.push(...functionCallOutputs(outputs));
  }
  return { reply: "", called, metrics };
}

async function judge(openai, fixture, reply, called) {
  const history = (fixture.history || []).map((m) => `${m.role}: ${m.content}`).join("\n");
  const instructions =
    'You grade one coaching reply against a stated expectation. Reply with JSON only: ' +
    '{"pass":true|false,"why":"one sentence"}. Judge only the expectation, not style or ' +
    "language. Be strict about anything the expectation says the reply must NOT do.";
  const response = await createCoachResponse(openai, {
    instructions,
    input: [{
      role: "user",
      content:
        `## Expectation\n${fixture.expect}\n\n` +
        (history ? `## Earlier in the conversation\n${history}\n\n` : "") +
        `## Athlete asked\n${fixture.message}\n\n` +
        `## Tools the coach called\n${called.join(", ") || "none"}\n\n` +
        `## Coach replied\n${reply}`,
    }],
    model: JUDGE_MODEL,
    maxOutputTokens: 1000,
    reasoningEffort: "low",
    allowTools: false,
    cacheKey: "dzr-coach-eval:judge",
  });
  const text = response.text || "";
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return { pass: false, why: `could not parse judge output: ${text.slice(0, 120)}` };
  }
}

function fail(name, ...lines) {
  console.log(`FAIL  ${name}`);
  lines.forEach((line) => console.log(`        ${line}`));
}

async function main() {
  let failures = 0;
  const totals = { input: 0, output: 0, cached: 0, reasoning: 0, latencyMs: 0, calls: 0 };

  let openai = null;
  if (!DRY_RUN) {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set. Use --dry-run for structure checks only.");
      process.exit(2);
    }
    const OpenAI = require("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  const selected = ONLY ? fixtures.filter((f) => f.name.includes(ONLY)) : fixtures;
  const repeats = DRY_RUN ? 1 : REPEATS;

  for (let repeat = 1; repeat <= repeats; repeat++) {
    if (repeats > 1) console.log(`\n--- repeat ${repeat}/${repeats}: ${MODEL}, judge ${JUDGE_MODEL} ---`);
    for (const fixture of selected) {
      const label = repeats > 1 ? `${fixture.name} [${repeat}]` : fixture.name;
      const prompt = buildPrompt(fixture);
      const structural = checkPromptStructure(prompt, fixture);
      if (structural.length) {
        failures += 1;
        fail(label, ...structural.map((p) => `prompt: ${p}`));
        continue;
      }

      if (DRY_RUN) {
        console.log(`ok    ${label} (prompt ${prompt.length} chars)`);
        continue;
      }

      const { reply, called, metrics } = await runTurn(openai, fixture, prompt);
      for (const key of Object.keys(totals)) totals[key] += metrics[key] || 0;
      const toolsLine = `tools: ${called.join(", ") || "none"}`;

      if (!reply.trim()) {
        failures += 1;
        fail(label, "empty reply", toolsLine);
        continue;
      }

      const missing = (fixture.expectTools || []).filter((name) => !called.includes(name));
      const unwanted = (fixture.forbidTools || []).filter((name) => called.includes(name));
      if (missing.length || unwanted.length) {
        failures += 1;
        fail(
          label,
          ...(missing.length ? [`expected tool(s) not called: ${missing.join(", ")}`] : []),
          ...(unwanted.length ? [`forbidden tool(s) called: ${unwanted.join(", ")}`] : []),
          toolsLine
        );
        continue;
      }

      // Cheap deterministic guards run before the judge, so an obvious violation is never
      // argued away by a lenient grader.
      const forbidden = (fixture.forbid || []).filter((pattern) => pattern.test(reply));
      if (forbidden.length) {
        failures += 1;
        fail(label, `matched forbidden pattern: ${forbidden[0]}`, `reply: ${reply.slice(0, 200)}`);
        continue;
      }

      if (!fixture.expect) {
        console.log(`ok    ${label} (${toolsLine})`);
        continue;
      }

      const verdict = await judge(openai, fixture, reply, called);
      if (verdict.pass) {
        console.log(`ok    ${label} (${toolsLine})`);
      } else {
        failures += 1;
        fail(label, verdict.why, toolsLine, `reply: ${reply.slice(0, 300)}`);
      }
    }
  }

  const attempts = selected.length * repeats;
  console.log(`\n${attempts - failures}/${attempts} passed${DRY_RUN ? " (dry run: prompt structure only)" : ""}`);
  if (!DRY_RUN) {
    console.log(JSON.stringify({
      candidate: MODEL,
      judge: JUDGE_MODEL,
      repeats,
      ...totals,
      averageLatencyMsPerCall: totals.calls ? Math.round(totals.latencyMs / totals.calls) : 0,
    }));
  }
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
