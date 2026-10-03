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
const { coachToolsFor, reasoningEffortAfterTools } = require("../services/coachTools");
const { fixtures } = require("./fixtures");

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length);
const MODEL = process.env.COACH_EVAL_MODEL || "gpt-5-mini";
const BASE_EFFORT = process.env.COACH_EVAL_EFFORT || "low";
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
  const tools = coachToolsFor(Boolean(fixture.context.notesOptIn));
  const messages = [
    { role: "system", content: prompt },
    ...(fixture.history || []),
    { role: "user", content: fixture.message },
  ];
  const called = [];
  let effort = BASE_EFFORT;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 8000,
      reasoning_effort: effort,
      messages,
      ...(round < MAX_TOOL_ROUNDS ? { tools, tool_choice: "auto" } : {}),
    });
    const msg = response.choices[0]?.message || {};
    if (!msg.tool_calls?.length) return { reply: msg.content || "", called };

    messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      called.push(call.function.name);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(cannedToolResult(fixture, call.function.name)),
      });
    }
    if (ROUTING) effort = reasoningEffortAfterTools(called, BASE_EFFORT);
  }
  return { reply: "", called };
}

async function judge(openai, fixture, reply, called) {
  const history = (fixture.history || []).map((m) => `${m.role}: ${m.content}`).join("\n");
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 300,
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content:
          'You grade one coaching reply against a stated expectation. Reply with JSON only: ' +
          '{"pass":true|false,"why":"one sentence"}. Judge only the expectation, not style or ' +
          "language. Be strict about anything the expectation says the reply must NOT do.",
      },
      {
        role: "user",
        content:
          `## Expectation\n${fixture.expect}\n\n` +
          (history ? `## Earlier in the conversation\n${history}\n\n` : "") +
          `## Athlete asked\n${fixture.message}\n\n` +
          `## Tools the coach called\n${called.join(", ") || "none"}\n\n` +
          `## Coach replied\n${reply}`,
      },
    ],
  });
  const text = response.choices[0]?.message?.content || "";
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

  for (const fixture of selected) {
    const prompt = buildPrompt(fixture);
    const structural = checkPromptStructure(prompt, fixture);
    if (structural.length) {
      failures += 1;
      fail(fixture.name, ...structural.map((p) => `prompt: ${p}`));
      continue;
    }

    if (DRY_RUN) {
      console.log(`ok    ${fixture.name} (prompt ${prompt.length} chars)`);
      continue;
    }

    const { reply, called } = await runTurn(openai, fixture, prompt);
    const toolsLine = `tools: ${called.join(", ") || "none"}`;

    if (!reply.trim()) {
      failures += 1;
      fail(fixture.name, "empty reply", toolsLine);
      continue;
    }

    const missing = (fixture.expectTools || []).filter((name) => !called.includes(name));
    const unwanted = (fixture.forbidTools || []).filter((name) => called.includes(name));
    if (missing.length || unwanted.length) {
      failures += 1;
      fail(
        fixture.name,
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
      fail(fixture.name, `matched forbidden pattern: ${forbidden[0]}`, `reply: ${reply.slice(0, 200)}`);
      continue;
    }

    if (!fixture.expect) {
      console.log(`ok    ${fixture.name} (${toolsLine})`);
      continue;
    }

    const verdict = await judge(openai, fixture, reply, called);
    if (verdict.pass) {
      console.log(`ok    ${fixture.name} (${toolsLine})`);
    } else {
      failures += 1;
      fail(fixture.name, verdict.why, toolsLine, `reply: ${reply.slice(0, 300)}`);
    }
  }

  console.log(`\n${selected.length - failures}/${selected.length} passed${DRY_RUN ? " (dry run: prompt structure only)" : ""}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
