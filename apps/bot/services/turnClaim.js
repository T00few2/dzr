/**
 * Make sure only one bot process answers a Discord message.
 *
 * During a Render deploy the old and the new instance are both logged in to Discord for a while
 * (until the new one passes its health check, plus the old one's shutdown flush), so both receive
 * every message and both answered. The first to create the claim document answers; the other sees
 * ALREADY_EXISTS and stays quiet.
 *
 * Fails open: if Firestore cannot be reached, answering twice is better than not answering.
 */
const COLLECTION = "chat_turn_claims";
// Firestore can delete claims through a TTL policy on expireAt; they are useless after a deploy.
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
const ALREADY_EXISTS = 6;

async function claimChatTurn(db, { botId, messageId }, now = new Date()) {
  if (!db || !messageId) return true;
  try {
    await db.collection(COLLECTION).doc(`${botId || "bot"}_${messageId}`).create({
      claimedAt: now,
      expireAt: new Date(now.getTime() + CLAIM_TTL_MS),
      pid: process.pid,
    });
    return true;
  } catch (error) {
    if (error?.code === ALREADY_EXISTS || /already exists/i.test(String(error?.message || ""))) return false;
    console.warn("Chat turn claim failed; answering anyway:", error?.message || error);
    return true;
  }
}

module.exports = { claimChatTurn };
