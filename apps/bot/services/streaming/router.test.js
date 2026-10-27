const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createStreamingRouter } = require("./router");
const { StreamingError } = require("./model");

async function server(t, service) {
  const app = express();
  app.use("/streaming", createStreamingRouter(service));
  const listener = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  t.after(() => new Promise((resolve) => listener.close(resolve)));
  return `http://127.0.0.1:${listener.address().port}/streaming`;
}

test("HTTP endpoint enforces authentication, JSON, payload limits and per-key throttling", async (t) => {
  let calls = 0;
  const url = await server(t, { async callback(token, body) { calls++; assert.equal(token, "test-key"); return { accepted: true }; } });
  const post = (headers, body = "{}") => fetch(`${url}/obs`, { method: "POST", headers, body });
  assert.equal((await post({ "Content-Type": "application/json" })).status, 401);
  assert.equal((await post({ Authorization: "Bearer test-key" })).status, 415);
  const headers = { Authorization: "Bearer test-key", "Content-Type": "application/json" };
  assert.equal((await post(headers, "{broken")).status, 400);
  assert.equal((await post(headers, JSON.stringify({ extra: "x".repeat(3000) }))).status, 413);
  const valid = await post(headers);
  assert.equal(valid.status, 202);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.equal(calls, 1);
  for (let i = 0; i < 12; i++) await post(headers);
  assert.equal((await post(headers)).status, 429);
});

test("revoked key responses are generic, and Lua download contains no personal credentials", async (t) => {
  const url = await server(t, { async callback() { throw new StreamingError("invalid_key", "private detail", 401); } });
  const response = await fetch(`${url}/obs`, { method: "POST", headers: { Authorization: "Bearer revoked", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_key" });
  const download = await fetch(`${url}/dzr-stream.lua`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /attachment.*dzr-stream.lua/);
  const script = await download.text();
  assert.match(script, /OBS_FRONTEND_EVENT_STREAMING_STARTED/);
  assert.ok(!script.includes("os.execute"));
});
