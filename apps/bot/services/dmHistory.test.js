const test = require("node:test");
const assert = require("node:assert/strict");

const { fromDiscordMessage, dmRecordsToHistory, stripSentStamp, DM_READBACK_MAX_AGE_MS } = require("./dmHistory");

const BOT = "bot1";
const ATHLETE = "athlete1";
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

const rec = (authorId, content, hoursAgo, extra = {}) => ({
  authorId,
  content,
  createdAt: NOW - hoursAgo * HOUR,
  attachments: 0,
  components: 0,
  embeds: 0,
  ...extra,
});

const opts = { botId: BOT, athleteId: ATHLETE, now: NOW };

test("returns oldest first with coach as assistant and athlete as user", () => {
  // Discord returns newest first.
  const out = dmRecordsToHistory([
    rec(ATHLETE, "fint, men knæet driller", 1),
    rec(BOT, "Hvordan gik tærskelpasset i går?", 4),
  ], opts);
  assert.deepEqual(out, [
    { role: "assistant", content: "Hvordan gik tærskelpasset i går?" },
    { role: "user", content: "fint, men knæet driller" },
  ]);
});

test("joins a long coach reply that was split into chunks", () => {
  const out = dmRecordsToHistory([
    rec(BOT, "del 1", 2),
    rec(BOT, "del 2", 1.99),
  ], opts);
  assert.deepEqual(out, [{ role: "assistant", content: "del 1\ndel 2" }]);
});

test("drops messages older than the read-back window", () => {
  const out = dmRecordsToHistory([
    rec(BOT, "gammelt", DM_READBACK_MAX_AGE_MS / HOUR + 1),
    rec(BOT, "nyt", 1),
  ], opts);
  assert.deepEqual(out, [{ role: "assistant", content: "nyt" }]);
});

test("skips goal buttons, the how-it-works text and other authors", () => {
  const out = dmRecordsToHistory([
    rec(BOT, "Skal jeg gemme målet?", 3, { components: 1 }),
    rec(BOT, "🚴 **DZR Coach**\n\nDu kan få træningsråd…", 2.5),
    rec("someone-else", "hej", 2),
    rec(ATHLETE, "tak", 1),
  ], opts);
  assert.deepEqual(out, [{ role: "user", content: "tak" }]);
});

test("reduces a workout card to its title line", () => {
  const out = dmRecordsToHistory([
    rec(BOT, "🚴 **VO2 5x4** — ca. 55 min\nsteps…\nI Zwift: Workouts → Custom Workouts", 2, { attachments: 1 }),
  ], opts);
  assert.deepEqual(out, [{ role: "assistant", content: "[Workout card] 🚴 VO2 5x4 — ca. 55 min" }]);
});

test("caps each message and keeps only the most recent ones", () => {
  const long = "x".repeat(3000);
  const out = dmRecordsToHistory([
    rec(ATHLETE, "a", 5),
    rec(BOT, "b", 4),
    rec(ATHLETE, long, 3),
  ], { ...opts, maxChars: 100, limit: 2 });
  assert.equal(out.length, 2);
  assert.equal(out[0].content, "b");
  assert.equal(out[1].content.length, 100);
  assert.ok(out[1].content.endsWith("…"));
});

test("fromDiscordMessage reads the fields discord.js exposes", () => {
  const record = fromDiscordMessage({
    id: "m1",
    author: { id: BOT },
    content: "hej",
    createdTimestamp: NOW,
    attachments: { size: 1 },
    components: [],
    embeds: [],
  });
  assert.deepEqual(record, {
    id: "m1", authorId: BOT, content: "hej", createdAt: NOW, attachments: 1, components: 0, embeds: 0,
  });
});

test("can include the time of the first message in each group", () => {
  const out = dmRecordsToHistory([
    rec(BOT, "del 1", 2),
    rec(BOT, "del 2", 1.5),
  ], { ...opts, includeTime: true });
  assert.deepEqual(out, [
    { role: "assistant", content: "del 1\ndel 2", at: new Date(NOW - 2 * HOUR).toISOString() },
  ]);
});

test("can stamp each message with its Copenhagen send time", () => {
  const history = dmRecordsToHistory(
    [rec(BOT, "Kør roligt 60 min i morgen", 15), rec(ATHLETE, "Hvad skulle jeg i dag?", 1)],
    { ...opts, stampContent: true }
  );
  // 15 h before 12:00 UTC on Sat 3 Oct is 21:00 UTC on Fri 2 Oct: 23:00 in Copenhagen (CEST).
  assert.equal(history[0].content, "[sent Fri 2 Oct, 23:00] Kør roligt 60 min i morgen");
  assert.equal(history[1].content, "[sent Sat 3 Oct, 13:00] Hvad skulle jeg i dag?");
  assert.equal(history[0].at, undefined);
});

test("strips a sent-stamp copied onto the start of a reply, and nothing else", () => {
  assert.equal(stripSentStamp("[sent Sat 3 Oct, 13:00] Kør roligt i dag."), "Kør roligt i dag.");
  assert.equal(stripSentStamp("Kør roligt i dag. [sent Sat 3 Oct, 13:00]"), "Kør roligt i dag. [sent Sat 3 Oct, 13:00]");
  assert.equal(stripSentStamp("[Workout card] VO2 5x4"), "[Workout card] VO2 5x4");
  assert.equal(stripSentStamp(""), "");
});

test("handles empty and malformed input", () => {
  assert.deepEqual(dmRecordsToHistory(null, opts), []);
  assert.deepEqual(dmRecordsToHistory([null, {}, rec(ATHLETE, "   ", 1)], opts), []);
});
