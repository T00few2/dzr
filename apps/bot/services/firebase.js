const admin = require("firebase-admin");
const config = require("../config/config");
const shared = require("../constants.json");
const {
  emptyProfile,
  publicFields,
  snapshotProfile,
  mergeCoachProfileData,
  formatCoachProfileForPrompt,
  summarizePatch,
} = require("./coachProfile");
const {
  canEncryptCoachMemory,
  unwrapCoachMemoryDoc,
  persistCoachMemoryDoc,
  needsCoachMemoryMigration,
  unwrapChatNoteDoc,
  persistChatNoteDoc,
} = require("./tokenCrypto");
const {
  MAX_NOTES_PER_ATHLETE,
  MAX_EXTRACT_NOTES,
  sanitizeNote,
  isNearDuplicate,
} = require("./coachChatNotes");

// Initialize Firebase
const privateKey = config.firebase.privateKey;
if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not set in environment variables.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
  databaseURL: `https://${config.firebase.projectId}.firebaseio.com`,
});

const db = admin.firestore();
const COACH_CHAT_NOTES_COLLECTION = shared.firestore?.coachChatNotes || "coach_chat_notes";

function coachChatNotesCol(discordId) {
  return db.collection(COACH_CHAT_NOTES_COLLECTION).doc(String(discordId)).collection("notes");
}

function coachChatNotesParent(discordId) {
  return db.collection(COACH_CHAT_NOTES_COLLECTION).doc(String(discordId));
}

function unwrapNoteDocSafe(doc) {
  try {
    const note = unwrapChatNoteDoc({ ...(doc.data() || {}), id: doc.id });
    if (!note?.text) return null;
    return note;
  } catch (err) {
    console.warn("unwrapChatNoteDoc failed:", err?.message || err);
    return null;
  }
}

async function listCoachChatNotes(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return [];
  const snap = await coachChatNotesCol(id).orderBy("at", "desc").limit(MAX_NOTES_PER_ATHLETE).get();
  return snap.docs.map(unwrapNoteDocSafe).filter(Boolean);
}

async function pruneCoachChatNotes(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return;
  const snap = await coachChatNotesCol(id).orderBy("at", "asc").get();
  const overflow = snap.size - MAX_NOTES_PER_ATHLETE;
  if (overflow <= 0) return;
  const batch = db.batch();
  snap.docs.slice(0, overflow).forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function addCoachChatNotes(discordId, incoming, { at } = {}) {
  const id = String(discordId || "").trim();
  if (!id) return [];
  if (!canEncryptCoachMemory()) {
    console.warn("COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach chat notes in plaintext");
  }
  const existing = await listCoachChatNotes(id);
  const now = at instanceof Date ? at : new Date();
  const toAdd = [];
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const note = sanitizeNote(raw, now.toISOString());
    if (!note) continue;
    if (isNearDuplicate(note.text, existing) || isNearDuplicate(note.text, toAdd)) continue;
    toAdd.push(note);
    if (toAdd.length >= MAX_EXTRACT_NOTES) break;
  }
  if (!toAdd.length) return [];

  const batch = db.batch();
  batch.set(coachChatNotesParent(id), { discordId: id, updatedAt: now }, { merge: true });
  const created = [];
  for (const note of toAdd) {
    const ref = coachChatNotesCol(id).doc();
    const stamp = note.at ? new Date(note.at) : now;
    const when = Number.isNaN(stamp.getTime()) ? now : stamp;
    batch.set(ref, persistChatNoteDoc({
      discordId: id,
      at: when,
      text: note.text,
      kind: note.kind,
    }));
    created.push({
      id: ref.id,
      discordId: id,
      at: when.toISOString(),
      text: note.text,
      kind: note.kind,
    });
  }
  await batch.commit();
  await pruneCoachChatNotes(id);
  return created;
}

async function deleteCoachChatNote(discordId, noteId) {
  const id = String(discordId || "").trim();
  const nid = String(noteId || "").trim();
  if (!id || !nid) return false;
  await coachChatNotesCol(id).doc(nid).delete();
  return true;
}

async function deleteAllCoachChatNotes(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return 0;
  const col = coachChatNotesCol(id);
  let deleted = 0;
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

/**
 * Get user's linked ZwiftID from Discord ID
 */
async function getUserZwiftId(discordId) {
  const doc = await db.collection("users").doc(discordId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data().zwiftId;
}

/**
 * Link a Discord user to a ZwiftID
 */
async function linkUserZwiftId(discordId, username, zwiftId) {
  await db.collection("users").doc(discordId).set({
    discordId: discordId,
    username,
    zwiftId: zwiftId,
    zwiftLinkedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  }, { merge: true });
}

/**
 * Get today's club stats
 */
async function getTodaysClubStats() {
  const dateId = new Date().toISOString().split("T")[0];
  const clubDoc = await db.collection("club_stats").doc(dateId).get();
  
  if (!clubDoc.exists) {
    return null;
  }
  
  const docData = clubDoc.data();
  if (!docData?.data?.riders) {
    return null;
  }
  
  return docData.data.riders;
}

/**
 * Get latest club_stats document (by timestamp desc).
 * Useful when today's snapshot isn't present yet.
 *
 * Returns: { id, timestamp, clubId, riders } | null
 */
async function getLatestClubStats() {
  const snap = await db.collection("club_stats").orderBy("timestamp", "desc").limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const raw = doc.data() || {};
  const riders = Array.isArray(raw?.data?.riders) ? raw.data.riders : [];
  return {
    id: doc.id,
    timestamp: raw.timestamp || null,
    clubId: raw.clubId || raw?.data?.clubId || null,
    riders,
  };
}

/**
 * Get all linked Discord users with a ZwiftID.
 * Returns: Array<{ discordId, zwiftId }>
 */
async function getAllLinkedUsers() {
  const snap = await db.collection("users").get();
  if (snap.empty) return [];
  const out = [];
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const zwiftId = data.zwiftId;
    if (zwiftId === null || zwiftId === undefined || zwiftId === "") continue;
    out.push({ discordId: doc.id, zwiftId });
  }
  return out;
}

/**
 * Search for riders by name prefix
 */
async function searchRidersByName(searchTerm) {
  const riders = await getTodaysClubStats();
  if (!riders) {
    return [];
  }
  
  const lowerSearch = searchTerm.toLowerCase();
  return riders.filter(r => 
    r.name && r.name.toLowerCase().startsWith(lowerSearch)
  );
}

/**
 * Simple key-value bot state storage
 */
async function getBotState(key) {
  const doc = await db.collection("bot_state").doc(String(key)).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function setBotState(key, data) {
  await db.collection("bot_state").doc(String(key)).set(data, { merge: true });
}

/**
 * Get self-assignable role panels (same structure as used by the web role manager)
 */
async function getRolePanels() {
  const guildId = config.discord.guildId;
  // Preferred: use explicit guildId
  if (guildId) {
    const doc = await db.collection("selfRoles").doc(guildId).get();
    if (doc.exists) {
      return doc.data(); // { panels: { panelId: { ... } } }
    }
  }

  // Fallback: use first selfRoles document (for environments where DISCORD_GUILD_ID is not set)
  const snap = await db.collection("selfRoles").limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Derive structured DZR teams and race series from role panel data.
 * - Team = role with isTeamRole === true AND teamCaptainId set
 * - Series = role with no teamCaptainId (typically access to series channels)
 */
async function getDZRTeamsAndSeries() {
  const data = await getRolePanels();
  if (!data || !data.panels) {
    return { teams: [], series: [] };
  }

  const teams = [];
  const series = [];

  for (const [panelId, panel] of Object.entries(data.panels)) {
    const panelName = panel.name || panelId;
    const panelDescription = panel.description || "";
    const channelId = panel.channelId || null;

    for (const role of panel.roles || []) {
      const isTeam = !!role.isTeamRole && !!role.teamCaptainId;

      const base = {
        roleId: role.roleId,
        roleName: role.roleName || role.roleId,
        panelId,
        panelName,
        panelDescription,
        channelId,
        buttonColor: role.buttonColor || "Secondary",
        visibility: role.visibility || "public",
      };

      if (isTeam) {
        teams.push({
          ...base,
          teamName: role.teamName || base.roleName,
          raceSeries: role.raceSeries || null,
          division: role.division || null,
          rideTime: role.rideTime || null,
          lookingForRiders: !!role.lookingForRiders,
          teamCaptainId: role.teamCaptainId || null,
          captainDisplayName: role.captainDisplayName || null,
        });
      } else {
        series.push({
          ...base,
          raceSeries: role.raceSeries || null,
          requiresApproval: !!role.requiresApproval,
        });
      }
    }
  }

  return { teams, series };
}

/**
 * Get a single bot knowledge entry by key
 */
async function getBotKnowledge(key) {
  const doc = await db.collection("bot_knowledge").doc(String(key)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Get all bot knowledge entries
 */
async function getAllBotKnowledge() {
  const snap = await db.collection("bot_knowledge").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Paid DZR club membership for the current year (Vipps).
 * Verified Member Discord role is not enough.
 */
async function isPaidClubMember(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return false;
  const year = new Date().getUTCFullYear();
  try {
    const membershipSnap = await db.collection("memberships").doc(id).get();
    const membership = membershipSnap.exists ? membershipSnap.data() || {} : {};
    if (
      String(membership.currentStatus || "") === "club" &&
      typeof membership.coveredThroughYear === "number" &&
      membership.coveredThroughYear >= year
    ) {
      return true;
    }

    const paymentsSnap = await db
      .collection("payments")
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

/**
 * Get all signup board configurations
 */
async function getSignupBoardConfigs() {
  const snap = await db.collection("signup_board_configs").get();
  if (snap.empty) return [];
  
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

const COACH_USAGE_COLLECTION = shared.firestore?.coachUsage || "coach_usage";
const COACH_USAGE_EVENTS_COLLECTION = shared.firestore?.coachUsageEvents || "coach_usage_events";
const COACH_PROFILES_COLLECTION = shared.firestore?.coachProfiles || "coach_profiles";

function coachProfileRef(discordId) {
  return db.collection(COACH_PROFILES_COLLECTION).doc(String(discordId));
}

function toPlainProfile(data) {
  const src = unwrapCoachMemoryDoc(data && typeof data === "object" ? data : {});
  const pending = src.pendingConfirmation && typeof src.pendingConfirmation === "object"
    ? {
        summary: String(src.pendingConfirmation.summary || "").slice(0, 280),
        snapshotBefore: snapshotProfile(src.pendingConfirmation.snapshotBefore || {}),
        askedAt: src.pendingConfirmation.askedAt || null,
      }
    : null;
  return {
    ...publicFields(src),
    discordId: src.discordId || null,
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy === "user" || src.updatedBy === "coach" ? src.updatedBy : null,
    pendingConfirmation: pending,
  };
}

async function writeCoachProfileDoc(id, plain) {
  if (!canEncryptCoachMemory()) {
    console.warn("COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach memory in plaintext");
  }
  await coachProfileRef(id).set(persistCoachMemoryDoc({ discordId: id, ...plain }));
}

async function maybeMigrateCoachProfile(id, raw) {
  if (!raw || !needsCoachMemoryMigration(raw)) return false;
  try {
    const unwrapped = unwrapCoachMemoryDoc({ discordId: id, ...raw });
    await coachProfileRef(id).set(
      persistCoachMemoryDoc({
        discordId: id,
        updatedAt: raw.updatedAt || unwrapped.updatedAt || null,
        updatedBy: raw.updatedBy === "user" || raw.updatedBy === "coach" ? raw.updatedBy : null,
        ...publicFields(unwrapped),
        pendingConfirmation: unwrapped.pendingConfirmation || null,
      })
    );
    return true;
  } catch (err) {
    console.warn("coach memory encryption migrate failed:", err?.message || err);
    return false;
  }
}

async function migrateAllCoachProfiles() {
  if (!canEncryptCoachMemory()) {
    console.warn("coach memory encryption skipped: COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing");
    return { scanned: 0, migrated: 0 };
  }
  const snap = await db.collection(COACH_PROFILES_COLLECTION).get();
  let migrated = 0;
  for (const doc of snap.docs) {
    if (await maybeMigrateCoachProfile(doc.id, doc.data() || {})) migrated += 1;
  }
  console.log(`coach memory encryption: scanned ${snap.size}, migrated ${migrated}`);
  return { scanned: snap.size, migrated };
}

/**
 * Durable coaching constraints for one Discord user.
 */
async function getCoachProfile(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return { ...emptyProfile(), pendingConfirmation: null };
  const snap = await coachProfileRef(id).get();
  if (!snap.exists) return { ...emptyProfile(), discordId: id, pendingConfirmation: null };
  const raw = snap.data() || {};
  await maybeMigrateCoachProfile(id, raw);
  return toPlainProfile({ discordId: id, ...raw });
}

async function mergeCoachProfile(discordId, patch, { summary } = {}) {
  const id = String(discordId || "").trim();
  if (!id) throw new Error("discordId required");
  const ref = coachProfileRef(id);
  const snap = await ref.get();
  const existing = unwrapCoachMemoryDoc({ discordId: id, ...(snap.exists ? snap.data() || {} : {}) });
  const snapshotBefore = snapshotProfile(existing);
  const merged = mergeCoachProfileData(existing, patch);
  const now = new Date();
  const pendingConfirmation = {
    summary: summarizePatch(patch, summary),
    snapshotBefore,
    askedAt: now,
  };
  const doc = {
    discordId: id,
    ...merged,
    pendingConfirmation,
    updatedAt: now,
    updatedBy: "coach",
  };
  await writeCoachProfileDoc(id, doc);
  return toPlainProfile(doc);
}

async function confirmCoachProfile(discordId) {
  const id = String(discordId || "").trim();
  if (!id) throw new Error("discordId required");
  const snap = await coachProfileRef(id).get();
  const existing = unwrapCoachMemoryDoc({ discordId: id, ...(snap.exists ? snap.data() || {} : {}) });
  if (!existing.pendingConfirmation) {
    return { success: false, message: "Nothing pending to confirm." };
  }
  const summary = existing.pendingConfirmation.summary || null;
  await writeCoachProfileDoc(id, {
    ...publicFields(existing),
    pendingConfirmation: null,
    updatedAt: new Date(),
    updatedBy: "coach",
  });
  const next = await getCoachProfile(id);
  return { success: true, confirmed: true, summary, profile: next };
}

async function rejectCoachProfile(discordId) {
  const id = String(discordId || "").trim();
  if (!id) throw new Error("discordId required");
  const snap = await coachProfileRef(id).get();
  const existing = unwrapCoachMemoryDoc({ discordId: id, ...(snap.exists ? snap.data() || {} : {}) });
  const pending = existing.pendingConfirmation;
  if (!pending) {
    return { success: false, message: "Nothing pending to undo." };
  }
  const restored = snapshotProfile(pending.snapshotBefore || emptyProfile());
  const now = new Date();
  const doc = {
    discordId: id,
    ...restored,
    pendingConfirmation: null,
    updatedAt: now,
    updatedBy: "coach",
  };
  await writeCoachProfileDoc(id, doc);
  return {
    success: true,
    rejected: true,
    summary: pending.summary || null,
    profile: toPlainProfile(doc),
  };
}

/**
 * Increment coaching LLM usage for a Discord user. Never throws to the caller.
 */
async function recordCoachUsage({ discordId, username, model, promptTokens, completionTokens, totalTokens, openaiCalls }) {
  const id = String(discordId || "").trim();
  if (!id) return;
  const prompt = Math.max(0, Number(promptTokens) || 0);
  const completion = Math.max(0, Number(completionTokens) || 0);
  const total = Math.max(0, Number(totalTokens) || prompt + completion);
  const calls = Math.max(1, Number(openaiCalls) || 1);
  if (total <= 0 && calls <= 0) return;

  const now = new Date();
  const ref = db.collection(COACH_USAGE_COLLECTION).doc(id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? snap.data() || {} : {};
      tx.set(ref, {
        discordId: id,
        username: username || prev.username || null,
        promptTokens: Number(prev.promptTokens || 0) + prompt,
        completionTokens: Number(prev.completionTokens || 0) + completion,
        totalTokens: Number(prev.totalTokens || 0) + total,
        openaiCalls: Number(prev.openaiCalls || 0) + calls,
        messageCount: Number(prev.messageCount || 0) + 1,
        lastModel: model || prev.lastModel || null,
        firstUsedAt: prev.firstUsedAt || now,
        lastUsedAt: now,
        updatedAt: now,
      }, { merge: true });
    });
    await db.collection(COACH_USAGE_EVENTS_COLLECTION).add({
      discordId: id,
      username: username || null,
      model: model || null,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
      openaiCalls: calls,
      at: now,
    });
  } catch (err) {
    console.error("recordCoachUsage failed:", err?.message || err);
  }
}

module.exports = {
  db,
  getUserZwiftId,
  linkUserZwiftId,
  getTodaysClubStats,
  getLatestClubStats,
  getAllLinkedUsers,
  searchRidersByName,
  getBotState,
  setBotState,
  getRolePanels,
  getDZRTeamsAndSeries,
  getBotKnowledge,
  getAllBotKnowledge,
  getSignupBoardConfigs,
  isPaidClubMember,
  recordCoachUsage,
  getCoachProfile,
  mergeCoachProfile,
  confirmCoachProfile,
  rejectCoachProfile,
  formatCoachProfileForPrompt,
  migrateAllCoachProfiles,
  listCoachChatNotes,
  addCoachChatNotes,
  deleteCoachChatNote,
  deleteAllCoachChatNotes,
}; 