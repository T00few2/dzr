#!/usr/bin/env node
/**
 * Delete replyPreview from existing coach_feedback documents.
 *
 * The field is no longer written (see apps/bot/services/coachFeedback.js), but rows created
 * before that change still hold up to 280 characters of coach reply — which routinely quotes the
 * athlete's own illness, weight or FTP back at them, in cleartext.
 *
 * Ratings are preserved; only the text is removed.
 *
 *   node scripts/purge-feedback-previews.js --dry-run
 *   node scripts/purge-feedback-previews.js
 *
 * Needs the same Firebase Admin credentials as the site (FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 */
const admin = require("firebase-admin");

const DRY_RUN = process.argv.includes("--dry-run");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY first.");
  process.exit(2);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
});

async function main() {
  const db = admin.firestore();
  const snap = await db.collection("coach_feedback").get();

  const withPreview = snap.docs.filter((doc) => "replyPreview" in (doc.data() || {}));
  console.log(`${snap.size} feedback rows, ${withPreview.length} still carry a replyPreview.`);

  if (!withPreview.length) {
    console.log("Nothing to do.");
    return;
  }
  if (DRY_RUN) {
    console.log("Dry run — nothing written. Re-run without --dry-run to clear them.");
    return;
  }

  // Batched, so a large collection does not exceed Firestore's per-commit limit.
  const CHUNK = 400;
  for (let i = 0; i < withPreview.length; i += CHUNK) {
    const batch = db.batch();
    for (const doc of withPreview.slice(i, i + CHUNK)) {
      batch.update(doc.ref, { replyPreview: admin.firestore.FieldValue.delete() });
    }
    await batch.commit();
    console.log(`cleared ${Math.min(i + CHUNK, withPreview.length)}/${withPreview.length}`);
  }
  console.log("Done. Ratings kept, previews removed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
