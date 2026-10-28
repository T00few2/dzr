const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CHANNEL_ID, COLLECTION, EMBED_MODEL,
  announcementText, upsertMessages, removeMessage, searchAnnouncements, maybeSyncAnnouncements, invalidateCache, cosine,
} = require("./announcementIndex");

function fakeDb() {
  const docs = new Map();
  const ref = (name, id) => ({
    key: `${name}/${id}`,
    id,
    get: async () => snap(`${name}/${id}`, id),
    delete: async () => docs.delete(`${name}/${id}`),
  });
  const snap = (key, id) => ({ id, exists: docs.has(key), data: () => docs.get(key), ref: ref(key.split("/")[0], id) });
  const list = (name) => [...docs.keys()].filter((k) => k.startsWith(`${name}/`)).map((k) => snap(k, k.slice(name.length + 1)));
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ref(name, id),
      get: async () => ({ docs: list(name) }),
      select: () => ({ get: async () => ({ docs: list(name) }) }),
    }),
    getAll: async (...refs) => refs.map((r) => snap(r.key, r.id)),
    batch: () => {
      const ops = [];
      return { set: (r, data) => ops.push([r, data]), commit: async () => ops.forEach(([r, data]) => docs.set(r.key, data)) };
    },
  };
}

// Two-dimensional "embeddings": recon posts point one way, kit posts the other.
function fakeEmbed(calls) {
  return async (texts) => {
    calls.push(texts.length);
    return texts.map((t) => (/recon/i.test(t) ? [1, 0] : /kit|tøj/i.test(t) ? [0, 1] : [0.7, 0.7]));
  };
}

const ADMIN = "1195852714270277763";

function message(id, content, { createdAt = new Date("2026-10-20T10:00:00Z"), channelId = CHANNEL_ID, embeds = [], type = 0, roles = [ADMIN], authorId = "u1" } = {}) {
  return {
    id, content, channelId, embeds, createdAt, editedAt: null, guildId: "g", type,
    member: { roles: { cache: new Map(roles.map((r) => [r, {}])) } },
    client: { user: { id: "bot" } },
    url: `https://discord.com/channels/g/${channelId}/${id}`,
    author: { id: authorId, username: "christian.kjaer" },
    guild: {
      roles: { cache: new Map([["1195878123795910736", { name: "👤 Medlem" }]]) },
      members: { cache: new Map() },
      channels: { cache: new Map([["42", { name: "race-schedule" }]]) },
    },
  };
}

test("announcement text reads mentions, channels, timestamps and embeds", () => {
  const text = announcementText(message("1", "Hej <@&1195878123795910736>, se <#42> <t:1761400000:F> <:dzr:123>", {
    embeds: [{ title: "Recon", description: "Søndag 9:50", fields: [{ name: "Rute", value: "Spiral Summit" }] }],
  }));
  assert.match(text, /@👤 Medlem/);
  assert.match(text, /#race-schedule/);
  assert.match(text, /2025-10-25 \d\d:\d\d UTC/);
  assert.match(text, /:dzr:/);
  assert.match(text, /Recon\nSøndag 9:50\nRute: Spiral Summit/);
});

// Indexed posts need some substance; this pads test posts past the minimum length.
const long = (text) => `${text}. Mere information følger her i kanalen.`;

test("upsert embeds only new or changed messages, and skips near-empty posts", async () => {
  const db = fakeDb();
  const calls = [];
  const deps = { db, embed: fakeEmbed(calls) };
  assert.deepEqual(await upsertMessages([message("1", long("Recon søndag")), message("2", long("Nyt kit"))], deps), { written: 2 });
  assert.deepEqual(await upsertMessages([message("1", long("Recon søndag")), message("2", long("Nyt kit"))], deps), { written: 0 });
  assert.deepEqual(await upsertMessages([message("2", long("Nyt kit, bestil nu"))], deps), { written: 1 });
  assert.deepEqual(calls, [2, 1]);
  const row = db.docs.get(`${COLLECTION}/1`);
  assert.equal(row.embedModel, EMBED_MODEL);
  assert.equal(row.author, "christian.kjaer");
  assert.deepEqual(await upsertMessages([message("3", ""), message("4", "<@&1195878123795910736>")], deps), { written: 0 });
});

test("search ranks by meaning, keeps the newest of near copies, and returns dates and links", async () => {
  invalidateCache();
  const db = fakeDb();
  const deps = { db, embed: fakeEmbed([]) };
  await upsertMessages([
    message("old", long("Recon på Watopia"), { createdAt: new Date("2026-10-10T10:00:00Z") }),
    message("new", long("Recon på Spiral Summit"), { createdAt: new Date("2026-10-24T10:00:00Z") }),
    message("kit", long("Nyt DZR tøj"), { createdAt: new Date("2026-10-01T10:00:00Z") }),
  ], deps);
  const hits = await searchAnnouncements("recon ride sunday", { limit: 2, now: new Date("2026-10-28T12:00:00Z") }, deps);
  assert.deepEqual(hits.map((h) => h.posted), ["2026-10-24", "2026-10-01"]);
  assert.match(hits[0].url, /\/new$/);
  assert.equal(hits[0].text, long("Recon på Spiral Summit"));
  assert.deepEqual(await searchAnnouncements("  ", {}, deps), []);
});

test("only normal posts by admins or this bot are indexed", async () => {
  const db = fakeDb();
  const deps = { db, embed: fakeEmbed([]) };
  const result = await upsertMessages([
    message("member", long("Skal man købe licensen?"), { roles: [] }),
    message("reply", long("Svar på et spørgsmål"), { type: 19 }),
    message("bot", long("Performance stats er nu på siden"), { roles: [], authorId: "bot" }),
    message("admin", long("Recon søndag")),
  ], deps);
  assert.deepEqual(result, { written: 2 });
  assert.deepEqual([...db.docs.keys()].sort(), [`${COLLECTION}/admin`, `${COLLECTION}/bot`]);
});

test("deleting a message drops it from search", async () => {
  invalidateCache();
  const db = fakeDb();
  const deps = { db, embed: fakeEmbed([]) };
  await upsertMessages([message("1", long("Recon søndag"))], deps);
  await removeMessage("1", deps);
  assert.deepEqual(await searchAnnouncements("recon", {}, deps), []);
});

test("daily sync runs once a day and removes rows for deleted or emptied messages", async () => {
  invalidateCache();
  const db = fakeDb();
  const state = {};
  const deps = {
    db,
    embed: fakeEmbed([]),
    getBotState: async (k) => state[k] || null,
    setBotState: async (k, v) => { state[k] = v; },
  };
  await upsertMessages([message("gone", long("Gammel recon")), message("emptied", long("Snart nyt"))], deps);
  const page = new Map([["1", message("1", long("Recon søndag"))], ["emptied", message("emptied", "ok")]]);
  page.last = () => page.get("emptied");
  const client = { channels: { fetch: async () => ({ messages: { fetch: async () => page } }) } };

  const first = await maybeSyncAnnouncements(client, deps, Date.parse("2026-10-28T12:00:00Z"));
  assert.deepEqual(first, { messages: 2, written: 1, removed: 2 });
  assert.equal(db.docs.has(`${COLLECTION}/gone`), false);
  assert.equal(db.docs.has(`${COLLECTION}/emptied`), false);
  assert.equal(await maybeSyncAnnouncements(client, deps, Date.parse("2026-10-28T13:00:00Z")), null);
});

test("cosine is 1 for the same direction and 0 for a zero vector", () => {
  assert.equal(Math.round(cosine([1, 2], [2, 4]) * 1000) / 1000, 1);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test("a failed sync is retried after 15 minutes, not after a day", async () => {
  const state = {};
  const deps = {
    db: fakeDb(),
    embed: fakeEmbed([]),
    getBotState: async (k) => state[k] || null,
    setBotState: async (k, v) => { state[k] = { ...(state[k] || {}), ...v }; },
  };
  let fail = true;
  const page = new Map();
  const client = { channels: { fetch: async () => { if (fail) throw new Error("rate limited"); return { messages: { fetch: async () => page } }; } } };
  const t0 = Date.parse("2026-10-28T11:05:00Z");
  assert.equal(await maybeSyncAnnouncements(client, deps, t0), null);
  fail = false;
  assert.equal(await maybeSyncAnnouncements(client, deps, t0 + 5 * 60 * 1000), null, "too soon to retry");
  assert.deepEqual(await maybeSyncAnnouncements(client, deps, t0 + 16 * 60 * 1000), { messages: 0, written: 0, removed: 0 });
  assert.equal(await maybeSyncAnnouncements(client, deps, t0 + 60 * 60 * 1000), null, "synced today");
});

test("sync looks up authors one by one and keeps rows whose author lookup failed", async () => {
  invalidateCache();
  const db = fakeDb();
  const deps = { db, embed: fakeEmbed([]) };
  await upsertMessages([message("kept", long("Recon søndag"), { authorId: "flaky" })], deps);
  const lookedUp = [];
  const guild = {
    members: {
      cache: new Map(),
      fetch: async (id) => {
        lookedUp.push(id);
        if (id === "flaky") throw Object.assign(new Error("timeout"), { code: 500 });
        if (id === "left") throw Object.assign(new Error("Unknown Member"), { code: 10007 });
      },
    },
  };
  const msgs = [
    message("kept", long("Recon søndag"), { authorId: "flaky" }),
    message("gone", long("Gammel post"), { authorId: "left", roles: [] }),
    message("new", long("Nyt kit til salg"), { authorId: "flaky" }),
  ];
  const page = new Map(msgs.map((m) => [m.id, m]));
  page.last = () => msgs[msgs.length - 1];
  const client = { channels: { fetch: async () => ({ guild, messages: { fetch: async () => page } }) } };
  const { syncAnnouncements } = require("./announcementIndex");
  const result = await syncAnnouncements(client, deps);
  assert.deepEqual(lookedUp.sort(), ["flaky", "left"]);
  assert.deepEqual(result, { messages: 3, written: 0, removed: 0 });
  assert.equal(db.docs.has(`${COLLECTION}/kept`), true);
});
