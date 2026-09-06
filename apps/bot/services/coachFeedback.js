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

    await db.collection(COLLECTION).add({
      discordId: String(user.id),
      messageId: String(message.id),
      rating: emoji === "👍" ? 1 : -1,
      // The reply text is kept short and only for reading back what was rated. It is coach
      // output, not the athlete's words, and never leaves the admin view.
      replyPreview: String(message.content || "").slice(0, 280),
      at: new Date(),
    });
    return true;
  } catch (err) {
    console.warn("recordCoachFeedback failed:", err?.message || err);
    return false;
  }
}

module.exports = { recordCoachFeedback, COACH_FEEDBACK_COLLECTION: COLLECTION };
