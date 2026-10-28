/**
 * Whether members use the club bot in DMs, and whether it helps. Metadata only: no message text,
 * no reply text, ever (see docs/architecture/security.md).
 *
 *   assistant_dm_events      one doc per DM turn: who, when, onboarding stage, tools, time, outcome
 *   assistant_dm_usage/{id}  per-member turn count, first and last use
 *   assistant_dm_daily/{day} turns and distinct members per day (Copenhagen date)
 *   assistant_dm_feedback    one doc per 👍/👎 on a club bot DM reply: rating and tools, no content
 *   onboarding_dms/{id}      firstReplyAt / lastReplyAt / replyCount, for members who got onboarding DMs
 *   assistant_knowledge_gaps one doc per normalized topic the assistant could not answer
 *
 * Members marked test by /onboarding_reset are recorded with test: true so reports can leave them out.
 */
const shared = require("../constants.json");
const { createTurnMetadataStore } = require("./turnMetadata");

const COLLECTIONS = {
  events: shared.firestore.assistantDmEvents,
  usage: shared.firestore.assistantDmUsage,
  daily: shared.firestore.assistantDmDaily,
  feedback: shared.firestore.assistantDmFeedback,
  gaps: shared.firestore.assistantKnowledgeGaps,
  onboarding: shared.firestore.onboardingDms,
};

const GAP_CATEGORIES = ["membership", "teams", "races", "zwift", "discord", "coach", "other"];
const TOPIC_MAX = 80;
const REDRAFT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const RATINGS = { "👍": 1, "👎": -1 };

// Which tools produced a reply, keyed by the sent message ids, so a later rating can say so.
const turnMetadata = createTurnMetadataStore();

function copenhagenDay(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The latest onboarding step sent, as the member's stage. */
function onboardingStage(onboardingDoc) {
  let latest = null;
  for (const [key, entry] of Object.entries(onboardingDoc?.steps || {})) {
    const at = entry?.sentAt?.toMillis?.() ?? (entry?.sentAt ? new Date(entry.sentAt).getTime() : null);
    if (at != null && (!latest || at > latest.at)) latest = { key, at };
  }
  return latest?.key || null;
}

/**
 * Record one club-bot DM turn.
 * @param {{ discordId: string, toolsUsed: string[], turnMs: number, outcome: string }} turn
 */
async function recordClubDmTurn(turn, { db = require("./firebase").db, FieldValue = require("firebase-admin/firestore").FieldValue, now = new Date() } = {}) {
  const id = String(turn.discordId);
  const onboardingRef = db.collection(COLLECTIONS.onboarding).doc(id);
  const usageRef = db.collection(COLLECTIONS.usage).doc(id);
  const [onboardingSnap, usageSnap] = await Promise.all([onboardingRef.get(), usageRef.get()]);
  const onboarding = onboardingSnap.exists ? onboardingSnap.data() || {} : null;
  const test = Boolean(onboarding?.test);
  const tools = Array.from(new Set(turn.toolsUsed || [])).sort();

  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.events).doc(), {
    discordId: id,
    at: now,
    stage: onboardingStage(onboarding),
    toolsUsed: tools,
    turnMs: Math.round(turn.turnMs || 0),
    outcome: turn.outcome,
    ...(test ? { test: true } : {}),
  });
  batch.set(usageRef, {
    turns: FieldValue.increment(1),
    lastAt: now,
    ...(usageSnap.exists && usageSnap.data()?.firstAt ? {} : { firstAt: now }),
    ...(test ? { test: true } : {}),
  }, { merge: true });
  batch.set(db.collection(COLLECTIONS.daily).doc(copenhagenDay(now)), {
    turns: FieldValue.increment(1),
    members: FieldValue.arrayUnion(id),
  }, { merge: true });
  if (onboarding) {
    batch.set(onboardingRef, {
      replyCount: FieldValue.increment(1),
      lastReplyAt: now,
      ...(onboarding.firstReplyAt ? {} : { firstReplyAt: now }),
    }, { merge: true });
  }
  await batch.commit();
}

/** Remember which tools produced the sent reply messages, for a later 👍/👎. */
function rememberClubDmReply(sentMessages, tools) {
  const list = Array.isArray(sentMessages) ? sentMessages : [sentMessages];
  turnMetadata.remember(list.map((m) => m?.id).filter(Boolean), { tools: Array.from(new Set(tools || [])).sort() });
}

/**
 * Record 👍/👎 on one of the club bot's own DM replies. Counts only, like coach_feedback: a
 * rating never creates a knowledge-gap row, because without the text there is no topic.
 */
async function recordClubDmFeedback(reaction, user, { db = require("./firebase").db, now = new Date() } = {}) {
  try {
    if (user?.bot) return false;
    const rating = RATINGS[reaction?.emoji?.name];
    if (!rating) return false;
    if (reaction.partial) await reaction.fetch();
    const message = reaction.message?.partial ? await reaction.message.fetch() : reaction.message;
    if (message?.guildId || message?.author?.id !== reaction.client?.user?.id) return false;
    const meta = turnMetadata.lookup(message.id);
    await db.collection(COLLECTIONS.feedback).add({
      discordId: String(user.id),
      messageId: String(message.id),
      rating,
      at: now,
      ...(meta ? { tools: meta.tools } : {}),
    });
    return true;
  } catch (err) {
    console.warn("recordClubDmFeedback failed:", err?.message || err);
    return false;
  }
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are", "how", "what", "do", "i", "my",
  "en", "et", "den", "det", "de", "af", "til", "i", "på", "for", "og", "eller", "er", "hvordan", "hvad", "jeg", "min", "mit", "kan", "man",
]);

/** Paraphrases of one topic share an id: lowercase, accents folded, stopwords dropped, words sorted. */
function normalizeTopic(topic) {
  const words = String(topic || "")
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word));
  return Array.from(new Set(words)).sort().join("-").slice(0, 120);
}

/**
 * A question the assistant had no tool or article for. topic is the model's own one-line
 * summary, never a quote, and no user id is stored.
 */
async function recordKnowledgeGap({ topic, category }, { db = require("./firebase").db, now = new Date() } = {}) {
  const cleanTopic = String(topic || "").replace(/\s+/g, " ").trim().slice(0, TOPIC_MAX);
  const cleanCategory = GAP_CATEGORIES.includes(category) ? category : "other";
  const key = normalizeTopic(cleanTopic);
  if (!key) return { recorded: false };
  const gapId = `${cleanCategory}__${key}`;
  const ref = db.collection(COLLECTIONS.gaps).doc(gapId);
  const draft = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : null;
    // Draft an article for a new gap, and again when a solved gap comes back (the published
    // article did not cover it), at most once a week. Claimed here so two reports draft once.
    const lastDraft = toMs(data?.draftedAt);
    const draftNow = !lastDraft || (data?.status === "solved" && now.getTime() - lastDraft > REDRAFT_AFTER_MS);
    tx.set(ref, {
      ...(data || {}),
      topic: cleanTopic,
      category: cleanCategory,
      count: (data?.count || 0) + 1,
      firstAt: data?.firstAt || now,
      lastAt: now,
      // A new report after "solved" means the article did not cover it: open it again.
      status: "open",
      ...(draftNow ? { draftedAt: now } : {}),
    });
    return draftNow;
  });
  return { recorded: true, gapId, draft };
}

function toMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

module.exports = {
  recordClubDmTurn,
  rememberClubDmReply,
  recordClubDmFeedback,
  recordKnowledgeGap,
  normalizeTopic,
  onboardingStage,
  GAP_CATEGORIES,
  COLLECTIONS,
};
