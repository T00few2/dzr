const test = require("node:test");
const assert = require("node:assert/strict");
const shared = require("../../constants.json");
const { fakeDb } = require("./testDb");
const { parseFeatureNews, writeDraft, createDraft, publishDraft, closeDraft, expireDrafts, publishQueued, COLLECTION, MODERATORS_CHANNEL_ID } = require("./drafts");
const { runDaily } = require("./index");
const { DEFAULTS } = require("./settings");

const NOW = new Date("2026-10-29T11:00:00Z"); // 12:00 in Copenhagen
const HOUR = 60 * 60 * 1000;
const ANNOUNCEMENTS = shared.discord.channels.announcements;

function messages(list) {
  return { first: () => list[0], values: () => list.values() };
}

/** A client whose channels record sends; lastAt is the newest message time per channel. */
function fakeClient({ lastAt = {}, humanToday = false } = {}) {
  const sent = [];
  const channel = (id) => ({
    id,
    send: async (payload) => { sent.push({ id, payload }); return { id: `m${sent.length}`, url: `https://discord.com/channels/g/${id}/m${sent.length}` }; },
    messages: {
      fetch: async (options) => {
        if (typeof options === "string") return { embeds: [{}], edit: async () => {} };
        const list = [];
        if (lastAt[id] != null) list.push({ createdTimestamp: lastAt[id], author: { bot: true } });
        if (id === ANNOUNCEMENTS && humanToday) list.push({ createdTimestamp: NOW.getTime() - HOUR, author: { bot: false } });
        return messages(list);
      },
    },
  });
  return { sent, channels: { fetch: async (id) => channel(id) } };
}

function deps(db, answer = "Hej alle! Husk at linke jeres Zwift ID 🚴") {
  const calls = [];
  return { calls, db, now: () => NOW, generate: async (args) => { calls.push(args); return answer; } };
}

const CANDIDATE = {
  key: "unlinkedZwiftId",
  kind: "unlinkedZwiftId",
  priority: 2,
  score: 20,
  channelId: ANNOUNCEMENTS,
  cooldownDays: 14,
  reason: "20 af 300 mangler Zwift ID",
  facts: { unlinkedCount: 20 },
};

test("parseFeatureNews reads features and the post, and NOTHING gives null", () => {
  const parsed = parseFeatureNews("FEATURES:\n- Powerups på ruteprofil | Se hvor powerups ligger | Spørg botten\nPOST:\nNyt i botten!");
  assert.deepEqual(parsed, { features: [{ title: "Powerups på ruteprofil", pitch: "Se hvor powerups ligger", howTo: "Spørg botten", slug: "powerups-paa-ruteprofil" }], post: "Nyt i botten!" });
  assert.equal(parseFeatureNews("NOTHING"), null);
  assert.equal(parseFeatureNews("just text"), null);
});

test("feature news uses its own instructions; other topics get the post as written", async () => {
  const d = deps(fakeDb(), "NOTHING");
  assert.equal(await writeDraft({ ...CANDIDATE, kind: "newFeatures", facts: { commits: [] } }, d.generate), null);
  assert.match(d.calls[0].instructions, /NOTHING/);
  const written = await writeDraft(CANDIDATE, deps(fakeDb()).generate);
  assert.equal(written.text, "Hej alle! Husk at linke jeres Zwift ID 🚴");
});

test("a draft is posted to moderators with publish, edit and reject buttons", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  assert.equal(client.sent[0].id, MODERATORS_CHANNEL_ID);
  const ids = client.sent[0].payload.components[0].components.map((button) => button.data.custom_id);
  assert.deepEqual(ids, [`ann:publish:${id}`, `ann:edit:${id}`, `ann:reject:${id}`]);
  const stored = db.docs.get(`${COLLECTION}/${id}`);
  assert.equal(stored.status, "pending");
  assert.equal(stored.messageId, "m1");
  assert.equal(stored.expiresAt.getTime(), NOW.getTime() + 3 * 24 * HOUR);
});

test("publish posts in a quiet channel, once, and records history and cooldown", async () => {
  const db = fakeDb();
  const client = fakeClient({ lastAt: { [ANNOUNCEMENTS]: NOW.getTime() - 30 * HOUR } });
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  const result = await publishDraft(client, id, { by: "mod", settings: DEFAULTS }, deps(db));
  assert.equal(result.state, "published");
  const post = client.sent.find((row) => row.id === ANNOUNCEMENTS);
  assert.equal(post.payload.content, "Hej alle! Husk at linke jeres Zwift ID 🚴");
  assert.deepEqual(post.payload.allowedMentions, { parse: [] });
  const state = db.docs.get("bot_state/announcer");
  assert.equal(state.lastKind, "unlinkedZwiftId");
  assert.equal(state.published.length, 1);
  assert.equal(state.perSignal.unlinkedZwiftId.getTime(), NOW.getTime());
  const again = await publishDraft(client, id, { by: "mod2", settings: DEFAULTS }, deps(db));
  assert.equal(again.state, "published");
  assert.equal(client.sent.filter((row) => row.id === ANNOUNCEMENTS).length, 1);
});

test("publish while the channel is busy queues the draft; force posts it anyway", async () => {
  const db = fakeDb();
  const client = fakeClient({ lastAt: { [ANNOUNCEMENTS]: NOW.getTime() - 2 * HOUR } });
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  const queued = await publishDraft(client, id, { by: "mod", settings: DEFAULTS }, deps(db));
  assert.deepEqual([queued.state, queued.reason], ["queued", "channel_busy"]);
  assert.equal(db.docs.get(`${COLLECTION}/${id}`).approvedBy, "mod");
  const forced = await publishDraft(client, id, { by: "mod", force: true, settings: DEFAULTS }, deps(db));
  assert.equal(forced.state, "published");
});

test("an admin post in #announcements today holds the queue; it posts once the day allows", async () => {
  const db = fakeDb();
  const busy = fakeClient({ humanToday: true });
  const { id } = await createDraft(busy, CANDIDATE, DEFAULTS, deps(db));
  assert.equal((await publishDraft(busy, id, { by: "mod", settings: DEFAULTS }, deps(db))).reason, "admin_posted_today");
  assert.equal((await publishQueued(busy, DEFAULTS, deps(db))).state, "queued");
  const quiet = fakeClient();
  const posted = await publishQueued(quiet, DEFAULTS, deps(db));
  assert.equal(posted.state, "published");
});

test("an edited text is what gets posted", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  await publishDraft(client, id, { by: "mod", text: "Rettet tekst", settings: DEFAULTS }, deps(db));
  assert.equal(client.sent.find((row) => row.id === ANNOUNCEMENTS).payload.content, "Rettet tekst");
});

test("reject and expiry close the draft and start the topic's cooldown", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  assert.equal((await closeDraft(id, "rejected", { by: "mod" }, deps(db))).ok, true);
  assert.equal((await closeDraft(id, "rejected", { by: "mod" }, deps(db))).state, "rejected");
  assert.ok(db.docs.get("bot_state/announcer").perSignal.unlinkedZwiftId);
  assert.equal(db.docs.get("bot_state/announcer").published, undefined);

  const second = await createDraft(client, { ...CANDIDATE, key: "evergreen:a", kind: "evergreen" }, DEFAULTS, deps(db));
  const later = { ...deps(db), now: () => new Date(NOW.getTime() + 4 * 24 * HOUR) };
  await expireDrafts(client, later);
  assert.equal(db.docs.get(`${COLLECTION}/${second.id}`).status, "expired");
});

test("publishing feature news remembers the features, and events remember their names", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const news = { ...CANDIDATE, key: "newFeatures", kind: "newFeatures", priority: 1, facts: { commits: [] }, meta: { headSha: "h" } };
  const answer = "FEATURES:\n- Ruteprofiler | Profil med powerups | Spørg botten\nPOST:\nNyt!";
  const { id } = await createDraft(client, news, DEFAULTS, deps(db, answer));
  await publishDraft(client, id, { by: "mod", settings: DEFAULTS }, deps(db));
  const state = db.docs.get("bot_state/announcer");
  assert.deepEqual(state.shippedFeatures.map((feature) => feature.slug), ["ruteprofiler"]);

  db.docs.set("bot_state/announcer", { ...state, published: [] });
  const events = { ...CANDIDATE, key: "upcomingClubEvents", kind: "upcomingClubEvents", meta: { eventNames: ["DZR After Party"] } };
  const draft = await createDraft(client, events, DEFAULTS, deps(db));
  await publishDraft(client, draft.id, { by: "mod", force: true, settings: DEFAULTS }, deps(db));
  assert.ok(db.docs.get("bot_state/announcer").promotedEvents["DZR After Party"]);
});

function sources(overrides = {}) {
  return {
    memberCounts: async () => ({ communityCount: 300, unlinkedCount: 40, linkedCount: 200, notInCompanionCount: 5 }),
    fetchClubEvents: async () => [],
    commitLog: async () => ({ head: "h2", commits: [{ subject: "Internal refactor", body: "" }] }),
    silentDmCount: async () => 0,
    listKnowledge: async () => [],
    random: () => 0,
    ...overrides,
  };
}

test("runDaily drafts the top topic; feature news with nothing for members still advances the log", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const d = { db, now: () => NOW, generate: async ({ instructions }) => (/NOTHING/.test(instructions) ? "NOTHING" : "Opslag") };
  const result = await runDaily(client, { deps: d, sources: sources() });
  assert.equal(result.ranked[0].key, "newFeatures");
  assert.equal(result.picked.key, "unlinkedZwiftId");
  assert.ok(result.draftId);
  assert.equal(db.docs.get("bot_state/announcer").github.lastSha, "h2");
});

test("runDaily writes nothing on a dry run, while paused, or with too many open drafts", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const d = { db, now: () => NOW, generate: async () => "Opslag" };
  const dry = await runDaily(client, { dryRun: true, deps: d, sources: sources() });
  assert.equal(dry.picked.key, "newFeatures");
  assert.equal(client.sent.length, 0);

  db.docs.set("bot_state/announcer", { paused: true });
  assert.equal((await runDaily(client, { deps: d, sources: sources() })).skipped, "paused");

  db.docs.set("bot_state/announcer", {});
  db.docs.set(`${COLLECTION}/x1`, { status: "pending", signalKey: "a" });
  db.docs.set(`${COLLECTION}/x2`, { status: "queued", signalKey: "b" });
  assert.equal((await runDaily(client, { deps: d, sources: sources() })).skipped, "open_drafts");
});

/** A fake db whose writes of status "published" fail, as if Firestore went away after the post. */
function failingPublishDb() {
  const db = fakeDb();
  const collection = db.collection;
  db.collection = (name) => {
    const col = collection(name);
    return {
      ...col,
      doc: (id) => {
        const ref = col.doc(id);
        return { ...ref, set: async (data, options) => { if (data?.status === "published") throw new Error("firestore down"); return ref.set(data, options); } };
      },
    };
  };
  return db;
}

test("a post that went out is never handed back to the queue, even when recording it fails", async () => {
  const db = failingPublishDb();
  const client = fakeClient();
  const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
  const error = console.error;
  console.error = () => {};
  try {
    const result = await publishDraft(client, id, { by: "mod", settings: DEFAULTS }, deps(db));
    assert.equal(result.state, "published");
    assert.notEqual(db.docs.get(`${COLLECTION}/${id}`).status, "queued");
    assert.equal(await publishQueued(client, DEFAULTS, deps(db)), null);
    assert.equal(client.sent.filter((row) => row.id === ANNOUNCEMENTS).length, 1);
  } finally {
    console.error = error;
  }
});

test("a draft stuck in publishing can be decided on again once stale, and expires", async () => {
  const db = fakeDb();
  const client = fakeClient();
  db.docs.set(`${COLLECTION}/fresh`, { status: "publishing", publishingAt: new Date(NOW.getTime() - 2 * 60 * 1000), signalKey: "a", kind: "evergreen", expiresAt: new Date(0) });
  db.docs.set(`${COLLECTION}/stale`, { status: "publishing", publishingAt: new Date(NOW.getTime() - HOUR), signalKey: "b", kind: "evergreen", expiresAt: new Date(NOW.getTime() + HOUR) });
  db.docs.set(`${COLLECTION}/stuck`, { status: "publishing", publishingAt: new Date(NOW.getTime() - HOUR), signalKey: "c", kind: "evergreen", expiresAt: new Date(0) });
  assert.equal((await closeDraft("fresh", "rejected", { by: "mod" }, deps(db))).ok, false);
  assert.equal((await closeDraft("stale", "rejected", { by: "mod" }, deps(db))).ok, true);
  await expireDrafts(client, deps(db));
  assert.equal(db.docs.get(`${COLLECTION}/stuck`).status, "expired");
  assert.equal(db.docs.get(`${COLLECTION}/fresh`).status, "publishing");
});

test("a draft the moderators never saw is marked failed: no open slot, no cooldown, log not advanced", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const channelsFetch = client.channels.fetch;
  client.channels.fetch = async (id) => { if (id === MODERATORS_CHANNEL_ID) throw new Error("Missing Access"); return channelsFetch(id); };
  const d = { db, now: () => NOW, generate: async () => "FEATURES:\n- Ny funktion | Noget nyt | Spørg botten\nPOST:\nNyt!" };
  const error = console.error;
  console.error = () => {};
  try {
    const result = await runDaily(client, { deps: d, sources: sources({ commitLog: async () => ({ head: "h3", commits: [{ subject: "Ny funktion", body: "" }] }) }) });
    assert.equal(result.skipped, "draft_post_failed");
  } finally {
    console.error = error;
  }
  const stored = [...db.docs.entries()].filter(([key]) => key.startsWith(`${COLLECTION}/`)).map(([, value]) => value);
  assert.deepEqual(stored.map((draft) => draft.status), ["failed"]);
  assert.equal(db.docs.get("bot_state/announcer")?.github?.lastSha, undefined);
  assert.equal(db.docs.get("bot_state/announcer")?.perSignal, undefined);
});

test("a stale publishing draft no longer blocks new drafts; a fresh one does", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const d = { db, now: () => NOW, generate: async () => "Opslag" };
  db.docs.set(`${COLLECTION}/p1`, { status: "pending", signalKey: "x" });
  db.docs.set(`${COLLECTION}/s1`, { status: "publishing", publishingAt: new Date(NOW.getTime() - HOUR), signalKey: "y" });
  const result = await runDaily(client, { deps: d, sources: sources() });
  assert.ok(result.draftId);
  assert.equal(result.open, 1);

  const busy = fakeDb();
  busy.docs.set(`${COLLECTION}/p1`, { status: "pending", signalKey: "x" });
  busy.docs.set(`${COLLECTION}/f1`, { status: "publishing", publishingAt: new Date(NOW.getTime() - 60 * 1000), signalKey: "y" });
  assert.equal((await runDaily(client, { deps: { ...d, db: busy }, sources: sources() })).skipped, "open_drafts");
});

test("a draft whose card was posted stays pending when only storing the message id fails", async () => {
  const db = fakeDb();
  const client = fakeClient();
  const collection = db.collection;
  db.collection = (name) => {
    const col = collection(name);
    return {
      ...col,
      add: async (data) => {
        const ref = await col.add(data);
        return { ...ref, set: async (patch, options) => { if (patch?.messageId) throw new Error("firestore down"); return ref.set(patch, options); } };
      },
    };
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { id } = await createDraft(client, CANDIDATE, DEFAULTS, deps(db));
    assert.equal(db.docs.get(`${COLLECTION}/${id}`).status, "pending");
    assert.equal((await publishDraft(client, id, { by: "mod", settings: DEFAULTS }, deps(db))).state, "published");
  } finally {
    console.warn = warn;
  }
});
