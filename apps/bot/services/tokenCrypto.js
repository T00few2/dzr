// SOURCE OF TRUTH. Do not edit apps/bot/services/tokenCrypto.js directly.
//
// Render and Cloud Run build apps/* as their own project root, so this file is *copied* into
// apps/bot by `npm run sync:shared` (see scripts/sync-shared.js) rather than imported across the
// tree — a require("../../packages/...") cannot resolve from inside the deployed bot.
// The Next.js site imports this file directly via the @/* alias; tokenCrypto.d.ts keeps it typed.
//
// CI fails if the copy in apps/bot drifts from this file.

const crypto = require("crypto");

const PREFIX = "enc:v1:";

function hashKey(material) {
  return crypto.createHash("sha256").update(material, "utf8").digest();
}

function tokenKeyMaterial() {
  const explicit = String(process.env.STRAVA_TOKEN_KEY || "").trim();
  if (explicit) return explicit;
  const shared = String(process.env.STRAVA_CONNECT_SECRET || "").trim();
  if (shared) return `dzr-strava-tokens:${shared}`;
  return "";
}

function coachKeyMaterial() {
  const explicit = String(process.env.COACH_MEMORY_KEY || "").trim();
  if (explicit) return explicit;
  const shared = String(process.env.STRAVA_CONNECT_SECRET || "").trim();
  if (shared) return `dzr-coach-memory:${shared}`;
  const tokenKey = String(process.env.STRAVA_TOKEN_KEY || "").trim();
  if (tokenKey) return `dzr-coach-memory:${tokenKey}`;
  return "";
}

function getTokenKey() {
  const material = tokenKeyMaterial();
  if (!material) return null;
  return hashKey(material);
}

function getCoachKey() {
  const material = coachKeyMaterial();
  if (!material) return null;
  return hashKey(material);
}

function encryptWithKey(key, plaintext) {
  const text = String(plaintext || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

function decryptWithKey(key, value, label) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!raw.startsWith(PREFIX)) return raw;
  if (!key) {
    throw new Error(`Cannot decrypt ${label}: encryption key is not set`);
  }
  const parts = raw.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error(`Invalid encrypted ${label}`);
  const [ivB, tagB, dataB] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function toIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

/**
 * Refuse to write unencrypted secrets.
 *
 * encryptSecret()/encryptWithKey() previously fell back to returning the plaintext when no key
 * was configured, and the caller still wrote it into the *Enc fields and stamped
 * tokenEncVersion: 1 — so a doc could claim to be encrypted while holding cleartext, and the
 * only signal was a console.warn. Production is clean (verified: all profiles, notes and
 * connections are encrypted), so failing closed here cannot break existing data; it stops the
 * degraded state from ever being entered.
 *
 * Reads deliberately still accept plaintext: decryptWithKey() passes through values without the
 * enc:v1: prefix, so any legacy document stays readable.
 */
function requireKey(key, label) {
  if (!key) {
    throw new Error(
      `Refusing to write ${label} unencrypted: set COACH_MEMORY_KEY (or STRAVA_CONNECT_SECRET). ` +
      `Both Vercel and Render must use the same value.`
    );
  }
  return key;
}

/**
 * Short, non-reversible fingerprint of a key.
 *
 * Stored alongside ciphertext so a decrypt failure can be diagnosed: without it, a document
 * encrypted under a rotated or mismatched key is indistinguishable from a corrupt one — exactly
 * the ambiguity hit by strava_connections/271709901724581888, which decrypted under no known key
 * and could not be explained.
 *
 * Domain-separated from the key itself, and truncated, so it reveals nothing about the key.
 */
function keyFingerprint(key) {
  if (!key) return null;
  return crypto.createHash("sha256").update("dzr-keyid:").update(key).digest("hex").slice(0, 8);
}

/** Fingerprint of the coach memory key currently configured, or null. */
function coachKeyId() {
  return keyFingerprint(getCoachKey());
}

/** Fingerprint of the Strava token key currently configured, or null. */
function tokenKeyId() {
  return keyFingerprint(getTokenKey());
}

/**
 * Compare a stored fingerprint against the current key.
 *
 * Returns "unknown" when the document predates keyId — which is every document written before
 * this change. Reads must never fail on that: treating a missing keyId as a mismatch would break
 * all existing coach data at once.
 */
function compareKeyId(storedKeyId, currentKeyId) {
  if (!storedKeyId) return "unknown";
  if (!currentKeyId) return "no_key";
  return storedKeyId === currentKeyId ? "match" : "mismatch";
}

function canEncryptTokens() {
  return Boolean(getTokenKey());
}

function canEncryptCoachMemory() {
  return Boolean(getCoachKey());
}

function encryptSecret(plaintext) {
  const text = String(plaintext || "");
  if (!text) return "";
  return encryptWithKey(requireKey(getTokenKey(), "Strava tokens"), text);
}

function decryptSecret(value) {
  return decryptWithKey(getTokenKey(), value, "Strava token");
}

function readStravaTokens(data) {
  const src = data && typeof data === "object" ? data : {};
  const accessToken = decryptSecret(src.accessTokenEnc || src.accessToken || "");
  const refreshToken = decryptSecret(src.refreshTokenEnc || src.refreshToken || "");
  return { accessToken, refreshToken };
}

function hasStravaRefreshToken(data) {
  const src = data && typeof data === "object" ? data : {};
  return Boolean(src.refreshTokenEnc || src.refreshToken);
}

function encryptedTokenFields(accessToken, refreshToken) {
  return {
    accessTokenEnc: encryptSecret(accessToken),
    refreshTokenEnc: encryptSecret(refreshToken),
    tokenEncVersion: 1,
    tokenKeyId: tokenKeyId(),
  };
}

function needsTokenMigration(data) {
  const src = data && typeof data === "object" ? data : {};
  return Boolean((src.accessToken || src.refreshToken) && canEncryptTokens());
}

function packCoachMemory(plain) {
  const src = plain && typeof plain === "object" ? plain : {};
  return {
    ridesPerWeek: src.ridesPerWeek ?? null,
    sports: Array.isArray(src.sports) ? src.sports : [],
    weekly: Array.isArray(src.weekly) ? src.weekly : [],
    injuries: Array.isArray(src.injuries) ? src.injuries : [],
    goals: Array.isArray(src.goals) ? src.goals : [],
    style: src.style && typeof src.style === "object" ? src.style : { length: null, language: null, tone: null, notes: "" },
    notesOptIn: src.notesOptIn === true,
    followUpEveryDays: src.followUpEveryDays ?? null,
  };
}

function unwrapCoachMemoryDoc(data) {
  const src = data && typeof data === "object" ? data : {};
  let packed = null;
  if (src.memoryEnc) {
    const json = decryptWithKey(getCoachKey(), src.memoryEnc, "coach memory");
    const parsed = JSON.parse(json || "{}");
    packed = packCoachMemory(parsed && typeof parsed === "object" ? parsed : {});
  }
  const fromPlain = packed || packCoachMemory(src);
  return {
    ...fromPlain,
    discordId: src.discordId || null,
    updatedAt: src.updatedAt || null,
    updatedBy: src.updatedBy || null,
    howItWorksSentAt: src.howItWorksSentAt || null,
    lastAthleteMessageAt: src.lastAthleteMessageAt || null,
    lastFollowUpAt: src.lastFollowUpAt || null,
    notesOptIn: fromPlain.notesOptIn === true,
  };
}

function packChatNote(plain) {
  const src = plain && typeof plain === "object" ? plain : {};
  const kind = String(src.kind || "").trim().toLowerCase();
  const allowed = new Set(["feeling", "plan", "preference_transient", "life", "race", "goal", "session"]);
  const eventDate = String(src.eventDate || "").trim().slice(0, 10);
  return {
    text: String(src.text || "").slice(0, 280),
    kind: allowed.has(kind) ? kind : "life",
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
  };
}

function unwrapChatNoteDoc(data) {
  const src = data && typeof data === "object" ? data : {};
  let packed = null;
  if (src.noteEnc) {
    const json = decryptWithKey(getCoachKey(), src.noteEnc, "coach chat note");
    const parsed = JSON.parse(json || "{}");
    packed = packChatNote(parsed && typeof parsed === "object" ? parsed : {});
  }
  const fromPlain = packed || packChatNote(src);
  return {
    id: src.id || null,
    discordId: src.discordId || null,
    at: toIso(src.at),
    text: fromPlain.text,
    kind: fromPlain.kind,
    eventDate: fromPlain.eventDate || null,
  };
}

function persistChatNoteDoc(plain) {
  const packed = packChatNote(plain);
  const meta = {
    discordId: plain?.discordId || null,
    at: plain?.at || new Date(),
  };
  const key = requireKey(getCoachKey(), "coach chat notes");
  return {
    ...meta,
    noteEnc: encryptWithKey(key, JSON.stringify(packed)),
    noteEncVersion: 1,
    noteKeyId: coachKeyId(),
  };
}

function persistCoachMemoryDoc(plain) {
  const packed = packCoachMemory(plain);
  const meta = {
    discordId: plain?.discordId || null,
    updatedAt: plain?.updatedAt || null,
    updatedBy: plain?.updatedBy || null,
    notesOptIn: packed.notesOptIn === true,
    howItWorksSentAt: plain?.howItWorksSentAt || null,
    lastAthleteMessageAt: plain?.lastAthleteMessageAt || null,
    lastFollowUpAt: plain?.lastFollowUpAt || null,
  };
  const key = requireKey(getCoachKey(), "coach memory");
  return {
    ...meta,
    memoryEnc: encryptWithKey(key, JSON.stringify(packed)),
    memoryEncVersion: 1,
    memoryKeyId: coachKeyId(),
  };
}

/**
 * Member calendar entries.
 *
 * Encrypted with the coach key even though the calendar is not coach data: members write free
 * text into it ("easy week, still coughing"), which is the same category of personal detail the
 * coach memory bar was set for. Reusing the key rather than introducing a second one keeps the
 * canary and keyId drift detection covering this collection too.
 *
 * eventDate, source and status stay OUTSIDE the ciphertext so the API can order and filter
 * without decrypting every row — the same split coach_profiles uses for its timestamps.
 */
function packCalendarEntry(plain) {
  const src = plain && typeof plain === "object" ? plain : {};
  const kind = String(src.kind || "").trim().toLowerCase();
  const kinds = new Set(["session", "race", "event", "other"]);
  const startTime = String(src.startTime || "").trim();
  const sourceEventId = String(src.sourceEventId || "").trim().slice(0, 64);
  return {
    text: String(src.text || "").slice(0, 280),
    kind: kinds.has(kind) ? kind : "session",
    startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ? startTime : null,
    sourceEventId: /^[A-Za-z0-9_:-]+$/.test(sourceEventId) ? sourceEventId : null,
  };
}

function unwrapCalendarEntryDoc(data) {
  const src = data && typeof data === "object" ? data : {};
  let packed = null;
  if (src.entryEnc) {
    const json = decryptWithKey(getCoachKey(), src.entryEnc, "calendar entry");
    const parsed = JSON.parse(json || "{}");
    packed = packCalendarEntry(parsed && typeof parsed === "object" ? parsed : {});
  }
  const fromPlain = packed || packCalendarEntry(src);
  const eventDate = String(src.eventDate || "").trim().slice(0, 10);
  return {
    id: src.id || null,
    discordId: src.discordId || null,
    // Read back verbatim, never re-validated: sanitizeEventDate rejects past dates, which is
    // right on the way in and would silently blank every entry that has already happened.
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
    source: src.source === "coach" ? "coach" : "member",
    status: ["planned", "done", "skipped"].includes(src.status) ? src.status : "planned",
    createdAt: toIso(src.createdAt),
    updatedAt: toIso(src.updatedAt),
    text: fromPlain.text,
    kind: fromPlain.kind,
    startTime: fromPlain.startTime,
    sourceEventId: fromPlain.sourceEventId,
  };
}

function persistCalendarEntryDoc(plain) {
  const packed = packCalendarEntry(plain);
  const src = plain && typeof plain === "object" ? plain : {};
  const eventDate = String(src.eventDate || "").trim().slice(0, 10);
  const key = requireKey(getCoachKey(), "calendar entries");
  return {
    discordId: src.discordId || null,
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
    source: src.source === "coach" ? "coach" : "member",
    status: ["planned", "done", "skipped"].includes(src.status) ? src.status : "planned",
    createdAt: src.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entryEnc: encryptWithKey(key, JSON.stringify(packed)),
    entryEncVersion: 1,
    entryKeyId: coachKeyId(),
  };
}

const COACH_CANARY_PLAINTEXT = "dzr-coach-key-canary-v1";

/**
 * Encrypt the fixed canary string with the current coach key.
 * Stored once, then decrypted at bot startup to prove the key still matches the one that
 * encrypted existing coach memory. Uses a constant of its own rather than a member's profile:
 * pointing the canary at real data means deleting that athlete takes the bot down.
 */
function makeCoachCanary() {
  return encryptWithKey(requireKey(getCoachKey(), "coach key canary"), COACH_CANARY_PLAINTEXT);
}

/** True when `value` decrypts to the canary string under the current coach key. */
function verifyCoachCanary(value) {
  try {
    return decryptWithKey(getCoachKey(), value, "coach key canary") === COACH_CANARY_PLAINTEXT;
  } catch {
    return false;
  }
}

module.exports = {
  PREFIX,
  coachKeyId,
  tokenKeyId,
  compareKeyId,
  COACH_CANARY_PLAINTEXT,
  makeCoachCanary,
  verifyCoachCanary,
  canEncryptTokens,
  canEncryptCoachMemory,
  encryptSecret,
  decryptSecret,
  readStravaTokens,
  hasStravaRefreshToken,
  encryptedTokenFields,
  needsTokenMigration,
  unwrapCoachMemoryDoc,
  persistCoachMemoryDoc,
  unwrapChatNoteDoc,
  persistChatNoteDoc,
  unwrapCalendarEntryDoc,
  persistCalendarEntryDoc,
};
