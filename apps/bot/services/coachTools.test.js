const test = require("node:test");
const assert = require("node:assert/strict");

const {
  coachToolDefinitions,
  COACH_NOTE_TOOLS,
  coachToolsFor,
  reasoningEffortAfterTools,
} = require("./coachTools");

const names = (tools) => tools.map((t) => t.function.name);

test("every tool has a unique name and an object schema", () => {
  const all = names(coachToolDefinitions);
  assert.equal(new Set(all).size, all.length);
  for (const tool of coachToolDefinitions) {
    assert.equal(tool.type, "function");
    assert.equal(tool.function.parameters?.type, "object");
  }
});

test("note tools are only offered with chat notes on", () => {
  const off = names(coachToolsFor(false));
  const on = names(coachToolsFor(true));
  for (const name of COACH_NOTE_TOOLS) {
    assert.ok(on.includes(name), `${name} missing with notes on`);
    assert.ok(!off.includes(name), `${name} offered with notes off`);
  }
  assert.ok(off.includes("get_training_trend"));
});

test("coach info is offered regardless of chat notes", () => {
  assert.ok(names(coachToolsFor(false)).includes("get_coach_info"));
  assert.ok(names(coachToolsFor(true)).includes("get_coach_info"));
});

test("analysis tools raise the reasoning effort for the answer", () => {
  assert.equal(reasoningEffortAfterTools(["get_recent_activities"]), "low");
  assert.equal(reasoningEffortAfterTools(["get_recent_activities", "get_activity_metrics"]), "medium");
  assert.equal(reasoningEffortAfterTools(new Set(["get_wellness"])), "medium");
  assert.equal(reasoningEffortAfterTools([], "minimal"), "minimal");
});
