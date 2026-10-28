const crypto = require("node:crypto");

const PLATFORMS = ["youtube", "twitch"];
const HEARTBEAT_TTL_MS = 150_000;
const CHECK_INTERVAL_MS = 15_000;
const DISCOVERY_WINDOW_MS = 60 * 60_000;
const checkDelay = (attempt) => Math.min(300_000, CHECK_INTERVAL_MS * 2 ** Math.min(attempt, 5));
const discoveryExpired = (session, now) => !session.discoveredAt && now >= session.startedAt + DISCOVERY_WINDOW_MS;
const SNOWFLAKE = /^\d{17,20}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

class StreamingError extends Error {
  constructor(code, userMessage, status = 400) {
    super(code);
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
  }
}

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const registrationKey = (guildId, discordId) => `${guildId}_${discordId}`;
const sessionKey = (registration, platform) => `${registration.id}_${platform}`;
const announcementKey = (channelId, stream) => hash(`${channelId}:${stream.platform}:${stream.id}`);

function createToken(discordId) {
  return `dzrs_${discordId}.${crypto.randomBytes(32).toString("base64url")}`;
}

function tokenOwner(token) {
  return /^dzrs_(\d{17,20})\.[A-Za-z0-9_-]{43}$/.exec(token || "")?.[1] || null;
}

function tokenMatches(token, tokenHash) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash || "")) return false;
  return crypto.timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(tokenHash, "hex"));
}

// Parse identities, never fetch user-supplied URLs (including redirects).
function parseChannel(platform, input) {
  let value = String(input || "").trim();
  if (!value) return null;
  if (value.length > 200) throw new StreamingError("invalid_channel", "Kanallinket er for langt.");
  if (/^(?:https?:\/\/|www\.|(?:www\.)?(?:youtube\.com|twitch\.tv)\/)/i.test(value)) {
    let url;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); } catch { /* validated below */ }
    const hosts = platform === "youtube" ? ["youtube.com", "www.youtube.com"] : ["twitch.tv", "www.twitch.tv"];
    if (!url || !hosts.includes(url.hostname.toLowerCase()) || url.username || url.password || url.port || url.search || url.hash) {
      throw new StreamingError("invalid_channel", "Brug et direkte kanallink fra youtube.com eller twitch.tv.");
    }
    try { value = decodeURIComponent(url.pathname).replace(/\/$/, "").slice(1); } catch { value = ""; }
  }
  if (platform === "twitch" && /^[A-Za-z0-9_]{1,25}$/.test(value)) return { login: value.toLowerCase() };
  if (platform === "youtube") {
    value = value.replace(/^channel\//, "");
    if (/^UC[A-Za-z0-9_-]{22}$/.test(value)) return { id: value };
    if (/^@[\p{L}\p{N}_.·-]{3,30}$/u.test(value)) return { handle: value };
  }
  throw new StreamingError("invalid_channel", platform === "youtube"
    ? "YouTube: brug https://www.youtube.com/@kanal eller et /channel/UC…-link."
    : "Twitch: brug dit kanalnavn eller https://www.twitch.tv/kanal.");
}

function parseEvent(body, now = Date.now()) {
  if (!body || !PLATFORMS.includes(body.platform) || !["started", "heartbeat", "stopped", "test"].includes(body.event)
      || !/^[A-Za-z0-9_-]{16,80}$/.test(body.sessionId || "") || !Number.isSafeInteger(body.sequence) || body.sequence < 1
      || !Number.isSafeInteger(body.startedAt) || !Number.isSafeInteger(body.sentAt)
      || Math.abs(body.sentAt - now) > 120_000 || body.startedAt > body.sentAt || body.startedAt < now - 7 * 86400_000
      || (body.videoId && !VIDEO_ID.test(body.videoId))) {
    throw new StreamingError("invalid_event", "Ugyldig eller udløbet OBS-hændelse. Tjek computerens ur.");
  }
  return { platform: body.platform, event: body.event, sessionId: body.sessionId, sequence: body.sequence,
    startedAt: body.startedAt, sentAt: body.sentAt, videoId: body.videoId || null };
}

function youtubeLive(video, channelId) {
  const live = video?.liveStreamingDetails;
  return video?.snippet?.channelId === channelId && video?.status?.privacyStatus === "public"
    && video.snippet.liveBroadcastContent === "live" && Number.isFinite(Date.parse(live?.actualStartTime)) && !live.actualEndTime;
}

function announcementMessage(registration, stream) {
  return {
    content: `🔴 <@${registration.discordId}> er live på ${stream.platform === "youtube" ? "YouTube" : "Twitch"}!`,
    embeds: [{ title: String(stream.title || "Se livestream").slice(0, 256), url: stream.url,
      color: stream.platform === "youtube" ? 0xff0000 : 0x9146ff, timestamp: stream.startedAt }],
    allowedMentions: { parse: [] },
  };
}

module.exports = { PLATFORMS, HEARTBEAT_TTL_MS, CHECK_INTERVAL_MS, DISCOVERY_WINDOW_MS, checkDelay, discoveryExpired, SNOWFLAKE, VIDEO_ID, StreamingError,
  hash, registrationKey, sessionKey, announcementKey, createToken, tokenOwner, tokenMatches, parseChannel, parseEvent,
  youtubeLive, announcementMessage };
