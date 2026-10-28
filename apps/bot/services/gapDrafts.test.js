const test = require("node:test");
const assert = require("node:assert/strict");
const { draftGapArticle, publishDraft, rejectDraft, parseDraft, slugify, takeDraftSlot, handleGapDraftInteraction, MODERATORS_CHANNEL_ID } = require("./gapDrafts");
const { COLLECTIONS } = require("./assistantDmStats");

function fakeDb() {
  const docs = new Map();
  let auto = 0;
  const snap = (key) => ({ exists: docs.has(key), data: () => docs.get(key) });
  const write = (key, data, options) => docs.set(key, options?.merge ? { ...(docs.get(key) || {}), ...data } : { ...data });
  const ref = (name, id) => {
    const key = `${name}/${id}`;
    return { key, id, get: async () => snap(key), set: async (data, options) => write(key, data, options) };
  };
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ref(name, id),
      add: async (data) => { const r = ref(name, `d${++auto}`); write(r.key, data); return r; },
    }),
    runTransaction: async (fn) => {
      const ops = [];
      const result = await fn({ get: async (r) => snap(r.key), set: (r, data, options) => ops.push([r.key, data, options]) });
      ops.forEach((op) => write(...op));
      return result;
    },
  };
}

const NOW = new Date("2026-10-28T12:00:00Z");
const GAP_ID = "races__cykeltoej-dcu-krav";

function setup({ answer, success = true } = {}) {
  const db = fakeDb();
  db.docs.set(`${COLLECTIONS.gaps}/${GAP_ID}`, { topic: "krav til cykeltøj i DCU-løb", category: "races", count: 3, status: "open" });
  const sent = [];
  const client = {
    channels: {
      fetch: async (id) => ({ id, send: async (payload) => { sent.push({ id, payload }); return { id: "m1" }; } }),
    },
  };
  const helperCalls = [];
  const deps = {
    db,
    openai: {},
    now: () => NOW,
    runHelper: async (args) => { helperCalls.push(args); return { success, answer }; },
  };
  return { db, client, sent, deps, helperCalls };
}

const ANSWER = "TITLE: Cykeltøj i DCU-løb\nARTICLE:\nDu skal køre i DZR-trøje.\nKilder: https://discord.com/channels/g/c/1";

test("parseDraft reads title and article, and NOT_FOUND gives null", () => {
  assert.deepEqual(parseDraft(ANSWER), { title: "Cykeltøj i DCU-løb", content: "Du skal køre i DZR-trøje.\nKilder: https://discord.com/channels/g/c/1" });
  assert.equal(parseDraft("NOT_FOUND"), null);
  assert.equal(parseDraft("Some answer without the format"), null);
  assert.equal(parseDraft(""), null);
});

test("slugify folds Danish letters", () => {
  assert.equal(slugify("Cykeltøj i DCU-løb, år 2026!"), "cykeltoej-i-dcu-loeb-aar-2026");
  assert.equal(slugify("!!!"), "artikel");
});

test("a found answer is posted to moderators as a pending draft with buttons", async () => {
  const { db, client, sent, deps, helperCalls } = setup({ answer: ANSWER });
  const result = await draftGapArticle(client, GAP_ID, deps);
  assert.equal(result.state, "pending");
  assert.equal(helperCalls[0].asker.source, "gap_draft");
  assert.match(helperCalls[0].question, /krav til cykeltøj i DCU-løb/);
  assert.equal(sent[0].id, MODERATORS_CHANNEL_ID);
  const ids = sent[0].payload.components[0].components.map((b) => b.data.custom_id);
  assert.deepEqual(ids, [`gapdraft:publish:${result.id}`, `gapdraft:edit:${result.id}`, `gapdraft:reject:${result.id}`]);
  assert.equal(db.docs.get(`knowledge_gap_drafts/${result.id}`).messageId, "m1");
  assert.equal(db.docs.get(`${COLLECTIONS.gaps}/${GAP_ID}`).draftId, result.id);
});

test("no answer is posted as not_found with a link to write the article", async () => {
  const { client, sent, deps } = setup({ answer: "NOT_FOUND" });
  const result = await draftGapArticle(client, GAP_ID, deps);
  assert.equal(result.state, "not_found");
  const [link, close] = sent[0].payload.components[0].components;
  assert.match(link.data.url, /\/admin\/knowledge$/);
  assert.equal(close.data.custom_id, `gapdraft:reject:${result.id}`);
});

test("publishing writes the article, solves the gap, and only works once", async () => {
  const { db, client, deps } = setup({ answer: ANSWER });
  db.docs.set("bot_knowledge/cykeltoej-i-dcu-loeb", { title: "taken" });
  const { id } = await draftGapArticle(client, GAP_ID, deps);
  const first = await publishDraft(id, { by: "mod" }, deps);
  assert.equal(first.ok, true);
  assert.equal(first.key, "cykeltoej-i-dcu-loeb-2");
  const article = db.docs.get("bot_knowledge/cykeltoej-i-dcu-loeb-2");
  assert.deepEqual(article.tags, ["races", "auto"]);
  assert.equal(article.approvedBy, "mod");
  assert.equal(db.docs.get(`${COLLECTIONS.gaps}/${GAP_ID}`).status, "solved");
  assert.equal(db.docs.get(`${COLLECTIONS.gaps}/${GAP_ID}`).articleKey, "cykeltoej-i-dcu-loeb-2");
  assert.deepEqual(await publishDraft(id, { by: "mod2" }, deps), { ok: false, state: "published" });
  assert.deepEqual(await rejectDraft(id, { by: "mod2" }, deps), { ok: false, state: "published" });
});

test("an edited publish uses the moderator's text", async () => {
  const { db, client, deps } = setup({ answer: ANSWER });
  const { id } = await draftGapArticle(client, GAP_ID, deps);
  const result = await publishDraft(id, { title: "Tøjregler", content: "Rettet tekst", by: "mod" }, deps);
  assert.equal(result.key, "toejregler");
  assert.equal(db.docs.get("bot_knowledge/toejregler").content, "Rettet tekst");
});

test("rejecting leaves the gap open", async () => {
  const { db, client, deps } = setup({ answer: ANSWER });
  const { id } = await draftGapArticle(client, GAP_ID, deps);
  assert.equal((await rejectDraft(id, { by: "mod" }, deps)).ok, true);
  assert.equal(db.docs.get(`knowledge_gap_drafts/${id}`).state, "rejected");
  assert.equal(db.docs.get(`${COLLECTIONS.gaps}/${GAP_ID}`).status, "open");
});

test("only moderators can press the buttons", async () => {
  const { deps } = setup();
  const replies = [];
  const interaction = {
    customId: "gapdraft:publish:d1",
    memberPermissions: { has: () => false },
    user: { username: "member" },
    reply: async (r) => replies.push(r),
  };
  await handleGapDraftInteraction(interaction, deps);
  assert.equal(replies[0].ephemeral, true);
  assert.match(replies[0].content, /moderatorer/);
});

test("the daily draft cap stops further drafts that day", async () => {
  const day = new Date("2030-01-01T00:00:00Z");
  assert.equal(takeDraftSlot(day, 1), true);
  assert.equal(takeDraftSlot(day, 1), false);
});
