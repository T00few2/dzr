const test = require("node:test");
const assert = require("node:assert/strict");
const { recordClubDmTurn, recordClubDmFeedback, rememberClubDmReply, recordKnowledgeGap, normalizeTopic, onboardingStage, COLLECTIONS } = require("./assistantDmStats");

const FieldValue = {
  increment: (n) => ({ __inc: n }),
  arrayUnion: (...v) => ({ __union: v }),
};

function apply(current, patch) {
  const out = { ...(current || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value && value.__inc !== undefined) out[key] = (out[key] || 0) + value.__inc;
    else if (value && value.__union) out[key] = Array.from(new Set([...(out[key] || []), ...value.__union]));
    else out[key] = value;
  }
  return out;
}

function fakeDb() {
  const docs = new Map();
  let auto = 0;
  const ref = (name, id) => ({ key: `${name}/${id ?? `auto${++auto}`}`, get: async function () { return snap(this.key); } });
  const snap = (key) => ({ exists: docs.has(key), data: () => docs.get(key) });
  const write = (r, data, options) => docs.set(r.key, options?.merge ? apply(docs.get(r.key), data) : apply({}, data));
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ref(name, id),
      add: async (data) => { const r = ref(name); write(r, data); return r; },
    }),
    batch: () => {
      const ops = [];
      return { set: (r, data, options) => ops.push([r, data, options]), commit: async () => ops.forEach((op) => write(...op)) };
    },
    runTransaction: async (fn) => {
      const ops = [];
      const result = await fn({ get: async (r) => snap(r.key), set: (r, data, options) => ops.push([r, data, options]) });
      ops.forEach((op) => write(...op));
      return result;
    },
  };
}

const docsIn = (db, collection) => [...db.docs].filter(([key]) => key.startsWith(`${collection}/`)).map(([, data]) => data);

test("a DM turn records metadata only, counters, and the funnel reply for onboarded members", async () => {
  const db = fakeDb();
  db.docs.set(`${COLLECTIONS.onboarding}/u1`, { steps: { intro: { sentAt: new Date(1000) }, link_zwift_id_channel: { sentAt: new Date(2000) } } });
  const now = new Date("2026-10-27T10:00:00Z");
  await recordClubDmTurn({ discordId: "u1", toolsUsed: ["club_overview", "my_onboarding_status", "club_overview"], turnMs: 1234.4, outcome: "answered" }, { db, FieldValue, now });
  await recordClubDmTurn({ discordId: "u1", toolsUsed: [], turnMs: 10, outcome: "answered" }, { db, FieldValue, now: new Date("2026-10-27T11:00:00Z") });

  const events = docsIn(db, COLLECTIONS.events);
  assert.equal(events.length, 2);
  assert.deepEqual(Object.keys(events[0]).sort(), ["at", "discordId", "outcome", "stage", "toolsUsed", "turnMs"]);
  assert.equal(events[0].stage, "link_zwift_id_channel");
  assert.deepEqual(events[0].toolsUsed, ["club_overview", "my_onboarding_status"]);

  const usage = db.docs.get(`${COLLECTIONS.usage}/u1`);
  assert.equal(usage.turns, 2);
  assert.equal(usage.firstAt.toISOString(), now.toISOString());
  assert.deepEqual(db.docs.get(`${COLLECTIONS.daily}/2026-10-27`), { turns: 2, members: ["u1"] });

  const onboarding = db.docs.get(`${COLLECTIONS.onboarding}/u1`);
  assert.equal(onboarding.replyCount, 2);
  assert.equal(onboarding.firstReplyAt.toISOString(), now.toISOString());
});

test("members without onboarding DMs get no funnel doc; test members are flagged", async () => {
  const db = fakeDb();
  await recordClubDmTurn({ discordId: "u2", toolsUsed: [], turnMs: 1, outcome: "error" }, { db, FieldValue });
  assert.equal(db.docs.has(`${COLLECTIONS.onboarding}/u2`), false);
  db.docs.set(`${COLLECTIONS.onboarding}/u3`, { test: true });
  await recordClubDmTurn({ discordId: "u3", toolsUsed: [], turnMs: 1, outcome: "answered" }, { db, FieldValue });
  assert.equal(docsIn(db, COLLECTIONS.events).find((e) => e.discordId === "u3").test, true);
  assert.equal(db.docs.get(`${COLLECTIONS.usage}/u3`).test, true);
});

function reaction(emoji, { guildId = null, authorId = "bot", messageId = "m1" } = {}) {
  return { emoji: { name: emoji }, client: { user: { id: "bot" } }, message: { id: messageId, guildId, author: { id: authorId } } };
}

test("👍/👎 on the bot's own DM reply is recorded with tools, never content", async () => {
  const db = fakeDb();
  rememberClubDmReply([{ id: "m1" }], ["get_help_article"]);
  assert.equal(await recordClubDmFeedback(reaction("👎"), { id: "u1" }, { db }), true);
  const [doc] = docsIn(db, COLLECTIONS.feedback);
  assert.equal(doc.rating, -1);
  assert.deepEqual(doc.tools, ["get_help_article"]);
  assert.deepEqual(Object.keys(doc).sort(), ["at", "discordId", "messageId", "rating", "tools"]);
  assert.equal(docsIn(db, COLLECTIONS.gaps).length, 0);
});

test("other reactions, guild messages and other authors are ignored", async () => {
  const db = fakeDb();
  assert.equal(await recordClubDmFeedback(reaction("🎉"), { id: "u1" }, { db }), false);
  assert.equal(await recordClubDmFeedback(reaction("👍", { guildId: "g" }), { id: "u1" }, { db }), false);
  assert.equal(await recordClubDmFeedback(reaction("👍", { authorId: "u9" }), { id: "u1" }, { db }), false);
  assert.equal(await recordClubDmFeedback(reaction("👍"), { id: "b", bot: true }, { db }), false);
  assert.equal(db.docs.size, 0);
});

test("paraphrased gap topics merge into one row and a solved gap reopens", async () => {
  const db = fakeDb();
  await recordKnowledgeGap({ topic: "Krav til cykeltøj i DCU-løb", category: "races" }, { db });
  await recordKnowledgeGap({ topic: "krav til DCU løb cykeltøj?", category: "races" }, { db });
  const rows = docsIn(db, COLLECTIONS.gaps);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  const [key] = [...db.docs.keys()].filter((k) => k.startsWith(COLLECTIONS.gaps));
  db.docs.set(key, { ...db.docs.get(key), status: "solved" });
  await recordKnowledgeGap({ topic: "cykeltøj krav DCU løb", category: "races" }, { db });
  assert.equal(db.docs.get(key).status, "open");
  assert.equal(db.docs.get(key).count, 3);
});

test("gap topics are capped, categories fixed, and empty topics ignored", async () => {
  const db = fakeDb();
  await recordKnowledgeGap({ topic: "x".repeat(200), category: "secret" }, { db });
  const [row] = docsIn(db, COLLECTIONS.gaps);
  assert.equal(row.topic.length, 80);
  assert.equal(row.category, "other");
  assert.deepEqual(await recordKnowledgeGap({ topic: "  ", category: "teams" }, { db }), { recorded: false });
  assert.equal(normalizeTopic("Hvordan får jeg kittet?"), "faar-kittet");
});

test("stage is the latest sent onboarding step", () => {
  assert.equal(onboardingStage(null), null);
  assert.equal(onboardingStage({ steps: { intro: { sentAt: new Date(5) }, become_club_member: { sentAt: new Date(9) }, connect_intervals: { claimingAtMs: 3 } } }), "become_club_member");
});
