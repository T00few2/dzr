const test = require("node:test");
const assert = require("node:assert/strict");

const { compactToolResult } = require("./toolResult");

test("compactToolResult keeps power curves for the model", () => {
  const curves = [{ oldest: "2026-01-01", newest: "2026-02-28", points: [{ seconds: 300, watts: 368 }] }];
  const out = compactToolResult({ tool_call_id: "c1", success: true, curves, message: "ok" });
  assert.deepEqual(out.curves, curves);
});

test("compactToolResult tells the model when intervals.icu refused a permission", () => {
  const out = compactToolResult({ success: false, scope_denied: true, message: "refused" });
  assert.equal(out.scope_denied, true);
});
