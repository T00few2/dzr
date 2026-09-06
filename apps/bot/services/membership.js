// SOURCE OF TRUTH. Do not edit apps/bot/services/membership.js directly.
//
// Copied into apps/bot by `npm run sync:shared`; the Next.js site imports this file via the @/*
// alias. CI fails on drift.
//
// This is the gate on the entire coach feature: it decides who may talk to DZR Coach and who may
// read or write coach settings. The bot and the website must agree exactly, or a member could be
// admitted by one and refused by the other.
//
// The Firestore handle is injected because each runtime builds its own (firebase-admin in the
// bot, adminDb in Next), and this module must not import either.

/**
 * Paid DZR club membership for the current year.
 *
 * A Verified Member / community Discord role is deliberately not enough — those are free.
 * Fails closed: any error returns false rather than admitting someone.
 *
 * @param {object} db Firestore instance (bot `db` or Next `adminDb`)
 * @param {object} collections Collection names, e.g. { memberships, payments }
 * @param {string} discordId
 * @returns {Promise<boolean>}
 */
async function isPaidClubMember(db, collections, discordId) {
  const id = String(discordId || "").trim();
  if (!id) return false;
  const year = new Date().getUTCFullYear();
  try {
    const membershipSnap = await db.collection(collections.memberships).doc(id).get();
    const membership = membershipSnap.exists ? membershipSnap.data() || {} : {};
    if (
      String(membership.currentStatus || "") === "club" &&
      typeof membership.coveredThroughYear === "number" &&
      membership.coveredThroughYear >= year
    ) {
      return true;
    }

    // Fall back to the payment record, in case the rollup on memberships is stale.
    const paymentsSnap = await db
      .collection(collections.payments)
      .where("userId", "==", id)
      .where("status", "==", "succeeded")
      .get();

    let maxCovered = null;
    paymentsSnap.forEach((doc) => {
      const covered = doc.data()?.coveredThroughYear;
      if (typeof covered === "number" && (maxCovered == null || covered > maxCovered)) {
        maxCovered = covered;
      }
    });
    return maxCovered != null && maxCovered >= year;
  } catch (err) {
    console.error("isPaidClubMember failed", err?.message || err);
    return false;
  }
}

module.exports = { isPaidClubMember };
