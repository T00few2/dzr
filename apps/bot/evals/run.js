#!/usr/bin/env node
/**
 * Golden-set eval for the coach prompt.
 *
 *   node evals/run.js --dry-run   # build every prompt, assert structure, no API calls, free
 *   node evals/run.js             # also ask the model and judge the replies (costs tokens)
 *
 * Deliberately NOT in CI. It costs money and, being model output, it is not perfectly
 * deterministic — a flaky suite wired into CI is one people learn to ignore, which is worse than
 * no suite. Run it before and after a prompt change.
 *
 * Judgements are made by a model against the fixture's stated expectation rather than by string
 * matching, because the behaviours here ("does not claim the goal is saved") have many valid
 * phrasings and one wrong one.
 */
const { buildCoachPromptText } = require("../services/coachPrompt");
const { formatCoachToday } = require("../services/coachChatNotes");
const { fixtures } = require("./fixtures");

const DRY_RUN = process.argv.includes("--dry-run");
const MODEL = process.env.COACH_EVAL_MODEL || "gpt-5-mini";
const NOW = new Date("2026-09-06T12:00:00Z");

function buildPrompt(fixture) {
  return buildCoachPromptText({
    today: formatCoachToday(NOW),
    ...fixture.context,
  });
}

/** Structural checks that need no model and therefore no budget. */
function checkPromptStructure(prompt, fixture) {
  const problems = [];
  const required = [
    "## Today", "## Sport", "## Training load", "## Coach settings",
    "## Active goals", "## Chat notes", "## Illness and injury",
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
  return problems;
}

async function judge(openai, fixture, reply) {
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
        content: `## Expectation\n${fixture.expect}\n\n## Athlete asked\n${fixture.message}\n\n## Coach replied\n${reply}`,
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

  for (const fixture of fixtures) {
    const prompt = buildPrompt(fixture);
    const structural = checkPromptStructure(prompt, fixture);
    if (structural.length) {
      failures += 1;
      console.log(`FAIL  ${fixture.name}`);
      structural.forEach((p) => console.log(`        prompt: ${p}`));
      continue;
    }

    if (DRY_RUN) {
      console.log(`ok    ${fixture.name} (prompt ${prompt.length} chars)`);
      continue;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 900,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: fixture.message },
      ],
    });
    const reply = response.choices[0]?.message?.content || "";

    // Cheap deterministic guards run before the judge, so an obvious violation is never
    // argued away by a lenient grader.
    const forbidden = (fixture.forbid || []).filter((pattern) => pattern.test(reply));
    if (forbidden.length) {
      failures += 1;
      console.log(`FAIL  ${fixture.name}`);
      console.log(`        matched forbidden pattern: ${forbidden[0]}`);
      console.log(`        reply: ${reply.slice(0, 200)}`);
      continue;
    }

    const verdict = await judge(openai, fixture, reply);
    if (verdict.pass) {
      console.log(`ok    ${fixture.name}`);
    } else {
      failures += 1;
      console.log(`FAIL  ${fixture.name}`);
      console.log(`        ${verdict.why}`);
      console.log(`        reply: ${reply.slice(0, 300)}`);
    }
  }

  console.log(`\n${fixtures.length - failures}/${fixtures.length} passed${DRY_RUN ? " (dry run: prompt structure only)" : ""}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
