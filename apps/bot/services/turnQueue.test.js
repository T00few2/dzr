const test = require("node:test");
const assert = require("node:assert/strict");

const { createTurnQueue } = require("./turnQueue");

const tick = () => new Promise((r) => setImmediate(r));

test("runs turns for the same key one after another", async () => {
  const queue = createTurnQueue();
  const order = [];
  let releaseFirst;
  const first = queue.tryEnqueue("k", () => new Promise((r) => {
    order.push("first:start");
    releaseFirst = () => { order.push("first:end"); r(); };
  }));
  const second = queue.tryEnqueue("k", async () => { order.push("second"); });
  await tick();
  assert.deepEqual(order, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first:start", "first:end", "second"]);
});

test("different keys do not wait for each other", async () => {
  const queue = createTurnQueue();
  const order = [];
  const slow = queue.tryEnqueue("a", () => new Promise((r) => setTimeout(() => { order.push("a"); r(); }, 20)));
  const fast = queue.tryEnqueue("b", async () => { order.push("b"); });
  await Promise.all([slow, fast]);
  assert.deepEqual(order, ["b", "a"]);
});

test("a failing turn does not block the next one", async () => {
  const queue = createTurnQueue();
  const failing = queue.tryEnqueue("k", async () => { throw new Error("boom"); });
  const next = queue.tryEnqueue("k", async () => "ok");
  await assert.rejects(failing, /boom/);
  assert.equal(await next, "ok");
});

test("refuses new work once the queue is full, and recovers after", async () => {
  const queue = createTurnQueue({ maxWaiting: 2 });
  let release;
  const gate = new Promise((r) => { release = r; });
  const running = queue.tryEnqueue("k", () => gate);
  const waiting = [queue.tryEnqueue("k", async () => 1), queue.tryEnqueue("k", async () => 2)];
  assert.equal(queue.tryEnqueue("k", async () => 3), null);
  release();
  await Promise.all([running, ...waiting]);
  await tick();
  assert.equal(queue.size("k"), 0);
  assert.equal(await queue.tryEnqueue("k", async () => "again"), "again");
});
