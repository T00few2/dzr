const test = require("node:test");
const assert = require("node:assert/strict");
const { findZwiftEvents, dayWindow } = require("./zwiftEventSearch");

test("a Danish day becomes a window that covers it in UTC", () => {
  assert.deepEqual(dayWindow("2026-10-27"), { from: 1793052000, to: 1793145600 });
  assert.deepEqual(dayWindow("i går"), {});
});

test("searches with the day window and caches the answer", async () => {
  const calls = [];
  const search = async (...args) => { calls.push(args); return [{ zwiftEventId: 5673134, name: "Zwift Racing League - Race 5" }]; };
  const first = await findZwiftEvents({ query: "Zwift Racing League Race 5", date: "2026-10-27" }, { search });
  const again = await findZwiftEvents({ query: "zwift racing league race 5", date: "2026-10-27" }, { search });
  assert.equal(first.events[0].zwiftEventId, 5673134);
  assert.equal(again.events.length, 1);
  assert.deepEqual(calls, [["Zwift Racing League Race 5", 1793052000, 1793145600]]);
});

test("short queries and failures say what to do instead", async () => {
  assert.equal((await findZwiftEvents({ query: "zr" })).success, false);
  const failed = await findZwiftEvents({ query: "Some Race" }, { search: async () => { throw new Error("502"); } });
  assert.match(failed.message, /event link/);
});
