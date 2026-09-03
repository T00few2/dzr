const crypto = require("crypto");

const PREFIX = "enc:v1:";

function keyMaterial() {
  const explicit = String(process.env.STRAVA_TOKEN_KEY || "").trim();
  if (explicit) return explicit;
  const shared = String(process.env.STRAVA_CONNECT_SECRET || "").trim();
  if (shared) return `dzr-strava-tokens:${shared}`;
  return "";
}

function getKey() {
  const material = keyMaterial();
  if (!material) return null;
  return crypto.createHash("sha256").update(material, "utf8").digest();
}

function canEncryptTokens() {
  return Boolean(getKey());
}

function encryptSecret(plaintext) {
  const text = String(plaintext || "");
  if (!text) return "";
  const key = getKey();
  if (!key) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

function decryptSecret(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!raw.startsWith(PREFIX)) return raw;
  const key = getKey();
  if (!key) {
    throw new Error("Cannot decrypt Strava token: STRAVA_TOKEN_KEY / STRAVA_CONNECT_SECRET is not set");
  }
  const parts = raw.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted Strava token");
  const [ivB, tagB, dataB] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final(),
  ]).toString("utf8");
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

module.exports = {
  PREFIX,
  canEncryptTokens,
  encryptSecret,
  decryptSecret,
  readStravaTokens,
  hasStravaRefreshToken,
  encryptedTokenFields,
  needsTokenMigration,
};
