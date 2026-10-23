/**
 * When someone replies to one of the bot's messages, give the model that message.
 *
 * Chat history is in memory per user and channel, expires after 30 minutes and is lost on a
 * restart. A reply from another user, or a late reply, would otherwise reach the model without
 * the message it answers. Pure, so it can be unit tested without discord.js.
 */

const { stripSentStamp } = require("./dmHistory");

const REPLIED_MESSAGE_MAX_CHARS = 4000;

function truncate(text, maxChars) {
  const value = String(text || "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Text of a Discord message, including its embeds (rider stats and similar are embeds). */
function discordMessageText(message, { maxChars = REPLIED_MESSAGE_MAX_CHARS } = {}) {
  const parts = [];
  if (typeof message?.content === "string" && message.content.trim()) parts.push(message.content.trim());
  for (const embed of Array.isArray(message?.embeds) ? message.embeds : []) {
    const lines = [embed?.title, embed?.description];
    for (const field of Array.isArray(embed?.fields) ? embed.fields : []) {
      if (field?.name || field?.value) lines.push(`${field.name || ""}: ${field.value || ""}`.trim());
    }
    if (embed?.footer?.text) lines.push(embed.footer.text);
    const text = lines.filter((line) => typeof line === "string" && line.trim()).join("\n");
    if (text) parts.push(text);
  }
  return truncate(parts.join("\n\n"), maxChars);
}

function sameStart(a, b) {
  // Coach DM history read back from Discord carries a "[sent …]" stamp.
  const head = (value) => stripSentStamp(String(value || "")).replace(/\s+/g, " ").trim().slice(0, 200);
  return head(a) !== "" && head(a) === head(b);
}

/**
 * Add the replied-to bot message as an assistant turn, unless it is already the latest one.
 * A reply to an older message adds it again, so the model knows which message is answered.
 * Returns the conversation (mutated) for convenience.
 */
function addRepliedMessage(conversation, repliedText) {
  const text = String(repliedText || "").trim();
  if (!text || !Array.isArray(conversation)) return conversation;
  const latest = [...conversation].reverse().find((entry) => entry?.role === "assistant");
  if (!latest || !sameStart(latest.content, text)) conversation.push({ role: "assistant", content: text });
  return conversation;
}

module.exports = { discordMessageText, addRepliedMessage, REPLIED_MESSAGE_MAX_CHARS };
