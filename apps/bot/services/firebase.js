const admin = require("firebase-admin");
const config = require("../config/config");
const shared = require("../constants.json");
const { isPaidClubMember: sharedIsPaidClubMember } = require("./membership");
const {
  emptyProfile,
  defaultProfile,
  publicFields,
} = require("./coachProfile");
const {
  canEncryptCoachMemory,
  unwrapCoachMemoryDoc,
  makeCoachCanary,
  verifyCoachCanary,
  persistCoachMemoryDoc,
  unwrapChatNoteDoc,
  persistChatNoteDoc,
  unwrapCalendarEntryDoc,
  persistCalendarEntryDoc,
} = require("./tokenCrypto");
const {
  MAX_NOTES_PER_ATHLETE,
  MAX_NOTES_PER_WRITE,
  MAX_ACTIVE_GOALS,
  sanitizeNote,
  isNearDuplicate,
  activeGoalNotes,
} = require("./coachChatNotes");
const {
  MAX_ENTRIES_PER_MEMBER,
  MAX_COACH_ENTRIES_PER_WEEK,
  sanitizeCalendarEntry,
  countRecentCoachEntries,
} = require("./memberCalendar");

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
const MEMBER_CALENDAR_COLLECTION = shared.firestore?.memberCalendar || "member_calendar";

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

/**
 * Member calendar.
 *
 * Not coach data: every verified member has one, including those without a coach, and the coach
 * data wipe deliberately leaves it alone. The bot reads it always and writes to it only when
 * chat notes are on — see addCalendarEntry.
 */
function memberCalendarCol(discordId) {
  return db.collection(MEMBER_CALENDAR_COLLECTION).doc(String(discordId)).collection("entries");
}

function unwrapCalendarDocSafe(doc) {
  try {
    const entry = unwrapCalendarEntryDoc({ ...(doc.data() || {}), id: doc.id });
    if (!entry?.text || !entry.eventDate) return null;
    return entry;
  } catch (err) {
    console.warn("unwrapCalendarEntryDoc failed:", err?.message || err);
    return null;
  }
}

async function listCalendarEntries(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return [];
  const snap = await memberCalendarCol(id)
    .orderBy("eventDate", "desc")
    .limit(MAX_ENTRIES_PER_MEMBER)
    .get();
  return snap.docs.map(unwrapCalendarDocSafe).filter(Boolean);
}

/**
 * Write one coach-proposed entry.
 *
 * Capped per week because a model handed a calendar it can fill will write a full training plan
 * into it, and the member's own entries then read as noise in their own calendar. Returns a
 * reason rather than throwing so the tool can tell the athlete what happened.
 *
 * @returns {Promise<{ok: boolean, reason?: string, entry?: object}>}
 */
async function addCalendarEntry(discordId, incoming, { source = "coach" } = {}) {
  const id = String(discordId || "").trim();
  if (!id) return { ok: false, reason: "no_discord_id" };

  const entry = sanitizeCalendarEntry({ ...incoming, source });
  if (!entry) return { ok: false, reason: "invalid" };

  const existing = await listCalendarEntries(id);
  if (existing.length >= MAX_ENTRIES_PER_MEMBER) return { ok: false, reason: "full" };
  if (source === "coach" && countRecentCoachEntries(existing) >= MAX_COACH_ENTRIES_PER_WEEK) {
    return { ok: false, reason: "coach_weekly_cap" };
  }
  // Adding the same thing twice on the same day is the failure mode here: the model re-proposes
  // a session it already saved earlier in the conversation.
  const duplicate = existing.some(
    (row) =>
      row.eventDate === entry.eventDate &&
      row.text.trim().toLowerCase() === entry.text.trim().toLowerCase()
  );
  if (duplicate) return { ok: false, reason: "duplicate" };

  await memberCalendarCol(id).doc().set(persistCalendarEntryDoc({ ...entry, discordId: id }));
  await db.collection(MEMBER_CALENDAR_COLLECTION).doc(id).set(
    { discordId: id, updatedAt: new Date() },
    { merge: true }
  );
  return { ok: true, entry };
}

function noteSkip(raw, reason, extra = {}) {
  const text = String(raw?.text || extra.text || "").trim().slice(0, 80);
  return {
    text: text || undefined,
    kind: extra.kind || raw?.kind || undefined,
    eventDate: extra.eventDate || raw?.eventDate || undefined,
    reason,
  };
}

async function addCoachChatNotes(discordId, incoming, { at, allowGoals = false, replaceNoteId } = {}) {
  const id = String(discordId || "").trim();
  const skipped = [];
  if (!id) return { saved: [], skipped };
  if (!canEncryptCoachMemory()) {
    console.warn("COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach chat notes in plaintext");
  }
  const existing = await listCoachChatNotes(id);
  const now = at instanceof Date ? at : new Date();
  const replaceId = String(replaceNoteId || "").trim();
  const activeGoals = activeGoalNotes(existing, now).filter((note) => note.id !== replaceId);
  const toAdd = [];
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const note = sanitizeNote(raw, now.toISOString());
    if (!note) {
      skipped.push(noteSkip(raw, "invalid"));
      continue;
    }
    if (note.kind === "goal" && !allowGoals) {
      skipped.push(noteSkip(raw, "goal_needs_confirm", note));
      continue;
    }
    if (note.kind === "goal") {
      const pendingGoals = toAdd.filter((item) => item.kind === "goal").length;
      if (activeGoals.length + pendingGoals >= MAX_ACTIVE_GOALS) {
        skipped.push(noteSkip(raw, "goal_cap", note));
        continue;
      }
    }
    if (isNearDuplicate(note.text, existing.filter((item) => item.id !== replaceId)) || isNearDuplicate(note.text, toAdd)) {
      skipped.push(noteSkip(raw, "duplicate", note));
      continue;
    }
    if (toAdd.length >= MAX_NOTES_PER_WRITE) {
      skipped.push(noteSkip(raw, "cap", note));
      continue;
    }
    toAdd.push(note);
  }
  if (!toAdd.length && !replaceId) return { saved: [], skipped };

  const batch = db.batch();
  batch.set(coachChatNotesParent(id), { discordId: id, updatedAt: now }, { merge: true });
  if (replaceId && allowGoals) {
    batch.delete(coachChatNotesCol(id).doc(replaceId));
  }
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
      eventDate: note.eventDate || null,
    }));
    created.push({
      id: ref.id,
      discordId: id,
      at: when.toISOString(),
      text: note.text,
      kind: note.kind,
      eventDate: note.eventDate || null,
    });
  }
  await batch.commit();
  await pruneCoachChatNotes(id);
  return { saved: created, skipped };
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
 * Paid DZR club membership for the current year.
 * Logic lives in the shared module so the bot and the website cannot disagree about who is a
 * member — this is the gate on the whole coach feature.
 */
async function isPaidClubMember(discordId) {
  return sharedIsPaidClubMember(db, {
    memberships: shared.firestore?.memberships || "memberships",
    payments: shared.firestore?.payments || "payments",
  }, discordId);
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

const COACH_USAGE_DAILY_COLLECTION = "coach_usage_daily";
const PENDING_GOALS_COLLECTION = "coach_pending_goals";

function usageDayKey(discordId, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Copenhagen",
  }).format(now);
  return `${discordId}_${day}`;
}


function coachProfileRef(discordId) {
  return db.collection(COACH_PROFILES_COLLECTION).doc(String(discordId));
}

function toPlainProfile(data) {
  const src = unwrapCoachMemoryDoc(data && typeof data === "object" ? data : {});
  return {
    ...publicFields(src),
    discordId: src.discordId || null,
    updatedAt: src.updatedAt || null,
    updatedBy: "user",
    howItWorksSentAt: src.howItWorksSentAt || null,
    lastAthleteMessageAt: src.lastAthleteMessageAt || null,
    lastFollowUpAt: src.lastFollowUpAt || null,
  };
}

async function writeCoachProfileDoc(id, plain) {
  if (!canEncryptCoachMemory()) {
    console.warn("COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach memory in plaintext");
  }
  await coachProfileRef(id).set(persistCoachMemoryDoc({ discordId: id, ...plain }));
}

/**
 * Coach settings for one Discord user.
 */
async function ensureDefaultCoachProfile(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return { ...emptyProfile() };
  const ref = coachProfileRef(id);
  const snap = await ref.get();
  if (snap.exists) {
    return toPlainProfile({ discordId: id, ...snap.data() });
  }
  const now = new Date();
  const doc = {
    discordId: id,
    ...defaultProfile(),
    updatedAt: now,
    updatedBy: "user",
    howItWorksSentAt: null,
    lastAthleteMessageAt: null,
    lastFollowUpAt: null,
  };
  await writeCoachProfileDoc(id, doc);
  return toPlainProfile(doc);
}

const FIRESTORE_NOT_FOUND = 5; // gRPC NOT_FOUND

/**
 * Stamp one bot-owned timestamp on a coach profile.
 *
 * These fields are stored OUTSIDE the encrypted blob (see persistCoachMemoryDoc), so they can be
 * written as a single-field merge. That matters: the previous implementation read the whole
 * profile, re-encrypted it and wrote it back with .set(), so a stamp landing while the athlete
 * was saving settings on Mine sider silently discarded their save — and the reverse ordering
 * dropped the stamp and broke follow-up scheduling.
 *
 * update() also fails with NOT_FOUND when the document is absent, which preserves the old
 * "do nothing for users who have never opened Coach" behaviour without needing a read first.
 */
async function stampCoachProfile(discordId, field) {
  const id = String(discordId || "").trim();
  if (!id) return false;
  try {
    await coachProfileRef(id).update({ [field]: new Date().toISOString() });
    return true;
  } catch (err) {
    if (err?.code === FIRESTORE_NOT_FOUND) return false;
    throw err;
  }
}

async function markCoachHowItWorksSent(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return;
  // Unlike the other two, this one must create the profile if it is missing.
  if (!(await stampCoachProfile(id, "howItWorksSentAt"))) {
    await ensureDefaultCoachProfile(id);
    await stampCoachProfile(id, "howItWorksSentAt");
  }
}

async function markCoachAthleteMessage(discordId) {
  await stampCoachProfile(discordId, "lastAthleteMessageAt");
}

async function markCoachFollowUpSent(discordId) {
  await stampCoachProfile(discordId, "lastFollowUpAt");
}

async function listCoachProfiles() {
  const snap = await db.collection(COACH_PROFILES_COLLECTION).get();
  return snap.docs.map((doc) => toPlainProfile({ discordId: doc.id, ...(doc.data() || {}) }));
}

async function getCoachProfile(discordId) {
  return ensureDefaultCoachProfile(discordId);
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
    // Per-day counter that backs the daily budget. Separate from the cumulative doc above,
    // which only ever increments and cannot answer "how much today".
    await db.collection(COACH_USAGE_DAILY_COLLECTION).doc(usageDayKey(id, now)).set({
      discordId: id,
      day: usageDayKey(id, now).split("_")[1],
      totalTokens: admin.firestore.FieldValue.increment(total),
      openaiCalls: admin.firestore.FieldValue.increment(calls),
      updatedAt: now,
    }, { merge: true });

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

const COACH_KEY_CANARY_STATE = "coach_key_canary";

/**
 * Prove the coach encryption key still matches the one that encrypted existing coach memory.
 *
 * Failing closed on a missing key (tokenCrypto.requireKey) only proves a key exists. It cannot
 * catch the case that actually corrupts data: Vercel and Render both configured, with different
 * values, so each writes memory the other cannot read. This decrypts a stored canary to catch it.
 *
 * Returns a result rather than throwing, so the caller can distinguish:
 *   - "mismatch"  -> the key is wrong; the bot must not start and write under it
 *   - "unavailable" -> Firestore could not be read; log and carry on, do not crash-loop
 */
async function checkCoachKeyCanary() {
  let snap;
  try {
    snap = await getBotState(COACH_KEY_CANARY_STATE);
  } catch (err) {
    return { status: "unavailable", message: err?.message || String(err) };
  }

  const stored = snap?.value;
  if (!stored) {
    try {
      await setBotState(COACH_KEY_CANARY_STATE, {
        value: makeCoachCanary(),
        createdAt: new Date().toISOString(),
      });
      return { status: "created" };
    } catch (err) {
      return { status: "unavailable", message: err?.message || String(err) };
    }
  }

  return verifyCoachCanary(stored) ? { status: "ok" } : { status: "mismatch" };
}

/**
 * Tokens this athlete has used today.
 *
 * coach_usage is cumulative — it only ever increments and carries no per-day breakdown — so it
 * cannot back a daily cap. This is a separate per-day counter.
 */
async function getCoachDailyTokens(discordId, now = new Date()) {
  const id = String(discordId || "").trim();
  if (!id) return 0;
  try {
    const snap = await db.collection(COACH_USAGE_DAILY_COLLECTION).doc(usageDayKey(id, now)).get();
    return snap.exists ? Number(snap.data()?.totalTokens || 0) : 0;
  } catch (err) {
    // Fail open: a Firestore blip must not lock an athlete out of coaching.
    console.warn("getCoachDailyTokens failed:", err?.message || err);
    return 0;
  }
}

/** Save a proposed goal so a deploy cannot silently expire a pending Ja/Nej. */
async function savePendingGoal(discordId, payload, ttlMs) {
  const id = String(discordId || "").trim();
  if (!id) return;
  await db.collection(PENDING_GOALS_COLLECTION).doc(id).set({
    discordId: id,
    ...payload,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  });
}

/** Read a pending goal, treating an expired one as absent. */
async function getPendingGoal(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return null;
  try {
    const snap = await db.collection(PENDING_GOALS_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.expiresAt && Date.parse(data.expiresAt) < Date.now()) return null;
    return data;
  } catch (err) {
    console.warn("getPendingGoal failed:", err?.message || err);
    return null;
  }
}

async function clearPendingGoal(discordId) {
  const id = String(discordId || "").trim();
  if (!id) return;
  try {
    await db.collection(PENDING_GOALS_COLLECTION).doc(id).delete();
  } catch (err) {
    console.warn("clearPendingGoal failed:", err?.message || err);
  }
}

module.exports = {
  db,
  checkCoachKeyCanary,
  getCoachDailyTokens,
  savePendingGoal,
  getPendingGoal,
  clearPendingGoal,
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
  ensureDefaultCoachProfile,
  markCoachHowItWorksSent,
  markCoachAthleteMessage,
  markCoachFollowUpSent,
  listCoachProfiles,
  listCoachChatNotes,
  addCoachChatNotes,
  listCalendarEntries,
  addCalendarEntry,
}; 