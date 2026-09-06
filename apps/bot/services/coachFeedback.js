const { db } = require("./firebase");

const COLLECTION = "coach_feedback";
const UP = ["👍", "👎"];

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
    await db.collection(COLLECTION).add({
      discordId: String(user.id),
      messageId: String(message.id),
      rating: emoji === "👍" ? 1 : -1,
      at: new Date(),
    });
    return true;
  } catch (err) {
    console.warn("recordCoachFeedback failed:", err?.message || err);
    return false;
  }
}

module.exports = { recordCoachFeedback, COACH_FEEDBACK_COLLECTION: COLLECTION };
