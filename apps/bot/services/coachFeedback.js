const { db } = require("./firebase");
const { createTurnMetadataStore } = require("./turnMetadata");

const COLLECTION = "coach_feedback";
const UP = ["👍", "👎"];

// Only filled for athletes with chat notes on; see rememberCoachTurn.
const turnMetadata = createTurnMetadataStore();

/**
 * Remember how a coach reply was made, so a later 👍/👎 on it can say which tools and settings
 * produced it. Call only for athletes with chat notes on — everyone else keeps a rating-only
 * record. Never includes reply text.
 */
function rememberCoachTurn(sentMessages, { tools = [], reasoningEffort = null, model = null } = {}) {
  const list = Array.isArray(sentMessages) ? sentMessages : [sentMessages];
  const ids = list.map((m) => m?.id).filter(Boolean);
  turnMetadata.remember(ids, {
    tools: Array.from(new Set(tools)).sort(),
    reasoningEffort,
    model,
  });
}

/**
 * Record 👍/👎 on a coach reply.
 *
 * The only quality signal available today is our own judgement. Automated evals catch
 * regressions; this catches the coaching being technically correct and still unhelpful, which no
 * assertion can see. Deliberately cheap: one document per reaction, no user-facing response, so
 * reacting stays a zero-friction thing an athlete does without being prompted.
 */
async function recordCoachFeedback(reaction, user) {
  try {
    if (user?.bot) return false;
    const emoji = reaction?.emoji?.name;
    if (!UP.includes(emoji)) return false;

    const message = reaction.message;
    // Only our own coach replies, and only in DMs.
    if (!message?.author?.bot) return false;
    if (message.guild) return false;

    // Rating only — deliberately no copy of the reply.
    //
    // An earlier version stored the first 280 characters of the coach's reply, on the reasoning
    // that it was bot output rather than the athlete's words. That distinction does not hold:
    // coach replies routinely quote the athlete's own data back at them ("du var syg i tirsdags,
    // og med dine 72 kg..."), so the preview was illness, weight and FTP in cleartext — in a
    // collection that, unlike coach_profiles and coach_chat_notes, is not encrypted and is not
    // covered by the delete controls on Mine sider.
    //
    // The counts are what the signal is for. To read *what* was rated, open the DM: messageId
    // identifies it. If richer context is ever needed for eval fixtures, store the exchange
    // deliberately — encrypted, deletable and disclosed — rather than keeping half a copy here.
    // Which tools and settings produced the reply — no content. Present only when the athlete
    // has chat notes on and the reply is from this process's lifetime.
    const meta = turnMetadata.lookup(message.id);
    await db.collection(COLLECTION).add({
      discordId: String(user.id),
      messageId: String(message.id),
      rating: emoji === "👍" ? 1 : -1,
      at: new Date(),
      ...(meta ? { tools: meta.tools, reasoningEffort: meta.reasoningEffort, model: meta.model } : {}),
    });
    return true;
  } catch (err) {
    console.warn("recordCoachFeedback failed:", err?.message || err);
    return false;
  }
}

module.exports = { recordCoachFeedback, rememberCoachTurn, COACH_FEEDBACK_COLLECTION: COLLECTION };
