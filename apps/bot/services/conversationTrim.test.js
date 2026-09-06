const test = require("node:test");
const assert = require("node:assert/strict");

const { trimConversation } = require("./conversationTrim");

const sys = { role: "system", content: "system prompt" };
const user = (n) => ({ role: "user", content: `u${n}` });
const asst = (n) => ({ role: "assistant", content: `a${n}` });
const asstCalls = (id) => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id, type: "function", function: { name: "get_recent_activities", arguments: "{}" } }],
});
const toolResult = (id) => ({ role: "tool", tool_call_id: id, content: "{}" });

/**
 * The invariant that matters: every `tool` message must be preceded (somewhere earlier in the
 * kept slice) by an assistant message whose tool_calls contain its tool_call_id. OpenAI rejects
 * the request otherwise.
 */
function assertNoOrphanToolMessages(messages) {
  const announced = new Set();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const call of msg.tool_calls) announced.add(call.id);
    }
    if (msg.role === "tool") {
      assert.ok(
        announced.has(msg.tool_call_id),
        `orphaned tool message ${msg.tool_call_id} — its tool_calls parent was trimmed away`
      );
    }
  }
}

test("returns the conversation untouched when it is short enough", () => {
  const convo = [sys, user(1), asst(1)];
  assert.equal(trimConversation(convo, 20), convo);
});

test("always keeps the system prompt first", () => {
  const convo = [sys];
  for (let i = 0; i < 40; i++) convo.push(user(i), asst(i));
  const out = trimConversation(convo, 10);
  assert.equal(out[0], sys);
  assert.equal(out[1].role, "user");
});

test("never orphans a tool message from its tool_calls parent", () => {
  // A tool-heavy coach turn: assistant requests 3 tools, 3 results come back.
  const convo = [sys];
  for (let turn = 0; turn < 12; turn++) {
    convo.push(user(turn));
    convo.push(asstCalls(`call_${turn}_a`));
    convo.push(toolResult(`call_${turn}_a`));
    convo.push(asst(turn));
  }
  // Every window size must produce a valid request, not just the default.
  for (let max = 1; max <= 30; max++) {
    const out = trimConversation(convo, max);
    assertNoOrphanToolMessages(out);
    assert.equal(out[0], sys, `system prompt dropped at max=${max}`);
  }
});

test("a positional slice would have produced an orphan — proving the test is meaningful", () => {
  const convo = [sys, user(1), asstCalls("call_x"), toolResult("call_x"), asst(1)];
  // The old implementation: keep system, then the last N.
  const naive = [convo[0], ...convo.slice(-2)]; // [system, toolResult, assistant]
  assert.throws(() => assertNoOrphanToolMessages(naive), /orphaned tool message/);
  // The helper anchors on a user turn instead.
  assertNoOrphanToolMessages(trimConversation(convo, 2));
});

test("falls back to the last user turn when none sits inside the window", () => {
  // A long tool-call tail with no recent user message.
  const convo = [sys, user(1), asstCalls("c1")];
  for (let i = 0; i < 30; i++) convo.push(toolResult("c1"));
  const out = trimConversation(convo, 5);
  assertNoOrphanToolMessages(out);
  assert.equal(out[0], sys);
  assert.equal(out[1].role, "user");
});

test("handles malformed entries without throwing", () => {
  const convo = [sys, null, undefined, user(1), asst(1), {}, user(2), asst(2)];
  const out = trimConversation(convo, 3);
  assert.equal(out[0], sys);
  assert.ok(out.length <= convo.length);
});
