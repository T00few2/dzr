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

function canEncryptTokens() {
  return Boolean(getTokenKey());
}

function canEncryptCoachMemory() {
  return Boolean(getCoachKey());
}

function encryptSecret(plaintext) {
  const text = String(plaintext || "");
  if (!text) return "";
  const key = getTokenKey();
  if (!key) return text;
  return encryptWithKey(key, text);
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
    notesOptIn: fromPlain.notesOptIn === true,
  };
}

function packChatNote(plain) {
  const src = plain && typeof plain === "object" ? plain : {};
  const kind = String(src.kind || "").trim().toLowerCase();
  const allowed = new Set(["feeling", "plan", "preference_transient", "life", "race"]);
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
  const key = getCoachKey();
  if (!key) {
    return { ...meta, ...packed };
  }
  return {
    ...meta,
    noteEnc: encryptWithKey(key, JSON.stringify(packed)),
    noteEncVersion: 1,
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
  };
  const key = getCoachKey();
  if (!key) {
    return { ...meta, ...packed };
  }
  return {
    ...meta,
    memoryEnc: encryptWithKey(key, JSON.stringify(packed)),
    memoryEncVersion: 1,
  };
}

module.exports = {
  PREFIX,
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
};
