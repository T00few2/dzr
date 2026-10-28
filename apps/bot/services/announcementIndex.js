/**
 * The announcements channel as a searchable source, so the bots answer club news from what admins
 * already posted instead of from hand-written articles.
 *
 *   announcement_index/{messageId}  { text, url, author, postedAt, editedAt, hash, embedding, embedModel }
 *
 * Only the announcements channel itself is indexed: never its threads or any member chat channel,
 * so everything the bot can quote was posted as an announcement. New, edited and deleted messages
 * update the index live; a daily sync catches anything missed while the bot was down.
 *
 * Search is by meaning (OpenAI embeddings), so a question in English finds a Danish announcement.
 * The whole index is a few hundred short messages, so it is scored in memory.
 */
const crypto = require("crypto");
const shared = require("../constants.json");

const CHANNEL_ID = shared.discord.channels.announcements;
const ADMIN_ROLE_ID = shared.discord.roles.admin;
const COLLECTION = shared.firestore.announcementIndex;
const EMBED_MODEL = process.env.ANNOUNCEMENT_EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIMENSIONS = 512;
const MAX_TEXT_CHARS = 6000;
const RESULT_TEXT_CHARS = 1500;
const CACHE_MS = 10 * 60 * 1000;
const SYNC_EVERY_MS = 24 * 60 * 60 * 1000;
const SYNC_STATE_KEY = "announcement_index_sync";
// Recent posts win a near tie: "the recon on Sunday" should find this week's, not last year's.
// The boost fades over RECENT_DAYS, so among copies of a weekly post the newest wins.
const RECENT_DAYS = 60;
const RECENT_BOOST = 0.04;
const DUPLICATE_SIMILARITY = 0.9;
// Posts shorter than this ("@medlem", a one-line joke) say nothing a member could ask about.
const MIN_TEXT_CHARS = 40;

let openaiClient = null;
function defaultEmbed() {
  return async (texts) => {
    if (!openaiClient) {
      const OpenAI = require("openai");
      const config = require("../config/config");
      if (!config.openai?.apiKey) throw new Error("OpenAI is not configured");
      openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
    }
    const res = await openaiClient.embeddings.create({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIMENSIONS });
    return res.data.map((d) => d.embedding);
  };
}

function defaultDeps() {
  // Required lazily: firebase initialises on load, which tests must not trigger.
  const firebase = require("./firebase");
  return { db: firebase.db, embed: defaultEmbed(), getBotState: firebase.getBotState, setBotState: firebase.setBotState };
}

let cache = { at: 0, rows: null };
function invalidateCache() {
  cache = { at: 0, rows: null };
}

function isAnnouncement(message) {
  return message?.channelId === CHANNEL_ID;
}

/**
 * Whether a message is an announcement the bot may quote: a normal post (not a reply or a system
 * notice) by this bot or by someone who holds the Admin role now. Members could post here in
 * 2024-25, and their chat must not become the bot's answers.
 */
function isIndexable(message) {
  if (message.type !== 0) return false;
  const byAdmin = message.member?.roles?.cache?.has(ADMIN_ROLE_ID);
  const byThisBot = message.author?.id && message.author.id === message.client?.user?.id;
  if (!byAdmin && !byThisBot) return false;
  return announcementText(message).length >= MIN_TEXT_CHARS;
}

/** Plain text of a message: content plus embeds, with mentions and timestamps made readable. */
function announcementText(message) {
  const guild = message.guild;
  const parts = [message.content || ""];
  for (const embed of message.embeds || []) {
    parts.push(embed.title || "", embed.description || "");
    for (const field of embed.fields || []) parts.push(`${field.name}: ${field.value}`);
  }
  return parts
    .filter(Boolean)
    .join("\n")
    .replace(/<@&(\d+)>/g, (_, id) => `@${guild?.roles?.cache?.get(id)?.name || "rolle"}`)
    .replace(/<@!?(\d+)>/g, (_, id) => {
      const member = guild?.members?.cache?.get(id);
      const user = message.mentions?.users?.get?.(id);
      return `@${member?.displayName || user?.username || "medlem"}`;
    })
    .replace(/<#(\d+)>/g, (_, id) => `#${guild?.channels?.cache?.get(id)?.name || "kanal"}`)
    .replace(/<t:(\d+)(?::[a-zA-Z])?>/g, (_, s) => new Date(Number(s) * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC")
    .replace(/<a?:(\w+):\d+>/g, ":$1:")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function hashText(text) {
  return crypto.createHash("sha1").update(`${EMBED_MODEL}:${EMBED_DIMENSIONS}:${text}`).digest("hex");
}

function toRow(message, text) {
  return {
    text,
    url: message.url || `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`,
    author: message.member?.displayName || message.author?.username || null,
    postedAt: message.createdAt || new Date(message.createdTimestamp),
    editedAt: message.editedAt || null,
  };
}

/**
 * Write the messages whose text changed, embedding them in one batch. Unchanged messages cost
 * nothing, so the daily sync can pass the whole channel.
 */
async function upsertMessages(messages, deps = defaultDeps()) {
  const candidates = [];
  for (const message of messages) {
    if (!isIndexable(message)) continue;
    const text = announcementText(message);
    candidates.push({ message, text, hash: hashText(text) });
  }
  if (!candidates.length) return { written: 0 };
  const refs = candidates.map((c) => deps.db.collection(COLLECTION).doc(c.message.id));
  const snaps = await deps.db.getAll(...refs);
  const changed = candidates.filter((c, i) => !snaps[i].exists || snaps[i].data()?.hash !== c.hash);
  let written = 0;
  for (let i = 0; i < changed.length; i += 100) {
    const chunk = changed.slice(i, i + 100);
    const vectors = await deps.embed(chunk.map((c) => c.text));
    const batch = deps.db.batch();
    chunk.forEach((c, j) => {
      batch.set(deps.db.collection(COLLECTION).doc(c.message.id), {
        ...toRow(c.message, c.text),
        hash: c.hash,
        embedding: vectors[j],
        embedModel: EMBED_MODEL,
      });
    });
    await batch.commit();
    written += chunk.length;
  }
  if (written) invalidateCache();
  return { written };
}

async function removeMessage(messageId, deps = defaultDeps()) {
  await deps.db.collection(COLLECTION).doc(String(messageId)).delete();
  invalidateCache();
}

/** Live updates from the gateway. Never throws: indexing must not break message handling. */
async function handleAnnouncementUpsert(message, deps) {
  if (!isAnnouncement(message)) return;
  try {
    if (message.partial) message = await message.fetch();
    // Fetched messages carry no member; the admin check needs the author's roles.
    if (!message.member && message.guild && message.author) await message.guild.members.fetch(message.author.id).catch(() => null);
    // An edit can shorten a post below the index minimum; drop the old text then.
    if (!isIndexable(message)) await removeMessage(message.id, deps);
    else await upsertMessages([message], deps);
  } catch (error) {
    console.warn("Announcement index update failed:", error?.message || error);
  }
}

async function handleAnnouncementDelete(message, deps) {
  if (!isAnnouncement(message)) return;
  try {
    await removeMessage(message.id, deps);
  } catch (error) {
    console.warn("Announcement index delete failed:", error?.message || error);
  }
}

/** Index the whole channel and drop rows for deleted messages. */
async function syncAnnouncements(client, deps = defaultDeps()) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  // Fetched messages carry no member, so load the members for the admin check.
  if (channel.guild) await channel.guild.members.fetch();
  const messages = [];
  let before;
  for (;;) {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    messages.push(...page.values());
    if (page.size < 100) break;
    before = page.last().id;
  }
  const { written } = await upsertMessages(messages, deps);
  const live = new Set(messages.filter(isIndexable).map((m) => m.id));
  const indexed = await deps.db.collection(COLLECTION).select().get();
  const gone = indexed.docs.filter((d) => !live.has(d.id));
  for (const doc of gone) await doc.ref.delete();
  if (gone.length) invalidateCache();
  return { messages: messages.length, written, removed: gone.length };
}

/** Called every scheduler minute; syncs once a day (and on the first tick after a fresh deploy). */
async function maybeSyncAnnouncements(client, deps = defaultDeps(), now = Date.now()) {
  try {
    const state = await deps.getBotState(SYNC_STATE_KEY);
    const last = Number(state?.lastRunAtMs) || 0;
    if (now - last < SYNC_EVERY_MS) return null;
    await deps.setBotState(SYNC_STATE_KEY, { lastRunAtMs: now });
    const result = await syncAnnouncements(client, deps);
    console.log(`📣 Announcement index synced: ${result.messages} messages, ${result.written} embedded, ${result.removed} removed`);
    return result;
  } catch (error) {
    console.error("Announcement index sync failed:", error?.message || error);
    return null;
  }
}

async function loadRows(deps, now = Date.now()) {
  if (cache.rows && now - cache.at < CACHE_MS) return cache.rows;
  const snap = await deps.db.collection(COLLECTION).get();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => Array.isArray(r.embedding) && r.embedModel === EMBED_MODEL);
  cache = { at: now, rows };
  return rows;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The announcements closest in meaning to the query, newest first among near ties. */
async function searchAnnouncements(query, { limit = 5, now = new Date() } = {}, deps = defaultDeps()) {
  const q = String(query || "").trim().slice(0, 500);
  if (!q) return [];
  const rows = await loadRows(deps, now.getTime());
  if (!rows.length) return [];
  const [vector] = await deps.embed([q]);
  const ranked = rows
    .map((row) => {
      const postedAt = toDate(row.postedAt);
      const ageDays = postedAt ? Math.max(0, (now - postedAt) / 86400000) : Infinity;
      const boost = ageDays < RECENT_DAYS ? RECENT_BOOST * (1 - ageDays / RECENT_DAYS) : 0;
      return { row, postedAt, score: cosine(vector, row.embedding) + boost };
    })
    .sort((a, b) => b.score - a.score);
  // Recurring posts (the weekly recon, the monthly ZwiftPower reminder) are near copies: show one
  // per group, in the group's best rank but with its newest copy, so other posts get the slots.
  const picked = [];
  for (const hit of ranked) {
    const i = picked.findIndex((p) => cosine(p.row.embedding, hit.row.embedding) > DUPLICATE_SIMILARITY);
    if (i >= 0) {
      if (hit.postedAt && (!picked[i].postedAt || hit.postedAt > picked[i].postedAt)) picked[i] = { ...hit, score: picked[i].score };
    } else if (picked.length < limit) {
      picked.push(hit);
    }
  }
  return picked
    .map(({ row, postedAt, score }) => ({
      posted: postedAt ? postedAt.toISOString().slice(0, 10) : null,
      author: row.author || null,
      url: row.url,
      text: String(row.text || "").slice(0, RESULT_TEXT_CHARS),
      relevance: Math.round(score * 100) / 100,
    }));
}

const searchAnnouncementsToolDefinition = {
  type: "function",
  function: {
    name: "search_announcements",
    description: "Search the DZR announcements channel, where admins post club news: events, group rides, race recons, campaigns, kit, new features, changes to how things work. Returns the closest posts with their date and link. Use it for DZR news and for any DZR question the knowledge base does not answer.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for, in a few words, any language, e.g. 'recon ride søndag' or 'kit order'." } },
      required: ["query"],
    },
  },
};

module.exports = {
  CHANNEL_ID,
  COLLECTION,
  EMBED_MODEL,
  announcementText,
  upsertMessages,
  removeMessage,
  handleAnnouncementUpsert,
  handleAnnouncementDelete,
  syncAnnouncements,
  maybeSyncAnnouncements,
  searchAnnouncements,
  searchAnnouncementsToolDefinition,
  invalidateCache,
  cosine,
};
