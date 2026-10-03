/**
 * Turn messages read back from the coach DM into chat history for the model.
 *
 * Nothing here is stored: the messages already live in the athlete's Discord DM, and this only
 * reshapes what Discord returns. Pure, so it can be unit tested without discord.js or Firebase.
 */

const DM_READBACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DM_MESSAGE_MAX_CHARS = 1500;
const HOW_IT_WORKS_PREFIX = "🚴 **DZR Coach**";

/** Reduce a discord.js Message to the fields the history needs. */
function fromDiscordMessage(message) {
  const createdAt = Number(message?.createdTimestamp ?? message?.createdAt?.getTime?.() ?? 0);
  return {
    id: message?.id ? String(message.id) : null,
    authorId: message?.author?.id ? String(message.author.id) : null,
    content: typeof message?.content === "string" ? message.content : "",
    createdAt,
    attachments: Number(message?.attachments?.size ?? message?.attachments?.length ?? 0),
    components: Number(message?.components?.length ?? 0),
    embeds: Number(message?.embeds?.length ?? 0),
  };
}

function truncate(text, maxChars) {
  const value = String(text || "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function firstLine(text) {
  return String(text || "").split("\n").find((line) => line.trim())?.replace(/\*\*/g, "").trim() || "";
}

/**
 * Convert DM records into `{ role, content }` messages, oldest first.
 *
 * - Only the coach (botId) and the athlete (athleteId) count; anything else is ignored.
 * - Goal-confirm messages (buttons) and the long "how it works" text are skipped.
 * - A workout card (it carries attachments) becomes one line naming the workout, so "the
 *   session you gave me" still resolves without replaying the install instructions.
 * - Consecutive messages from the same side are joined: long coach replies arrive in chunks.
 */
function dmRecordsToHistory(records, {
  botId,
  athleteId,
  now = Date.now(),
  maxAgeMs = DM_READBACK_MAX_AGE_MS,
  maxChars = DM_MESSAGE_MAX_CHARS,
  limit = 10,
  includeTime = false,
} = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const rows = (Array.isArray(records) ? records : [])
    .filter((r) => r && Number.isFinite(r.createdAt) && r.createdAt > 0)
    .filter((r) => nowMs - r.createdAt <= maxAgeMs)
    .sort((a, b) => a.createdAt - b.createdAt);

  const parts = [];
  for (const r of rows) {
    const fromCoach = botId && r.authorId === String(botId);
    const fromAthlete = athleteId && r.authorId === String(athleteId);
    if (!fromCoach && !fromAthlete) continue;

    let text = String(r.content || "").trim();
    if (fromCoach) {
      if (r.components > 0) continue;
      if (text.startsWith(HOW_IT_WORKS_PREFIX)) continue;
      if (r.attachments > 0) {
        const title = firstLine(text);
        if (!title) continue;
        text = `[Workout card] ${title}`;
      } else if (r.embeds > 0 && !text) {
        continue;
      }
    }
    if (!text) continue;
    parts.push({ role: fromCoach ? "assistant" : "user", content: text, createdAt: r.createdAt });
  }

  const merged = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.role === part.role) {
      last.content = `${last.content}\n${part.content}`;
    } else {
      merged.push({ ...part });
    }
  }

  return merged
    .slice(-Math.max(1, limit))
    .map((m) => {
      const out = { role: m.role, content: truncate(m.content, maxChars) };
      if (includeTime) out.at = new Date(m.createdAt).toISOString();
      return out;
    });
}

module.exports = {
  DM_READBACK_MAX_AGE_MS,
  DM_MESSAGE_MAX_CHARS,
  fromDiscordMessage,
  dmRecordsToHistory,
};
