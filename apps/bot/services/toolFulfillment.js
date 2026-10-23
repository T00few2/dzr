/**
 * Decide whether a proposed club-bot tool call does what the user asked, before it is run.
 *
 * Several tools are about the same rider (read an ID, link an ID, show stats, decide a category).
 * The router often picks a neighbouring one, and the handlers post to Discord immediately, so the
 * user sees the wrong result and the turn ends. This check is a yes/no about the proposed call,
 * which is a smaller question than choosing among the tools. It uses each tool's own description,
 * so a new tool is covered without a list of phrases.
 *
 * A missing or unreadable verdict means "allow". A failed check must not block a call that would
 * have worked.
 */

const FULFILLMENT_INSTRUCTIONS = `You decide whether one proposed tool call does what the user asked.

The user may write in any language, including casual Danish or English. Judge the action they want, not the wording.
A short follow-up ("list them all", "kan du liste alle") refers to the earlier conversation. Read it from the recent conversation when one is given.

Reading an ID back, linking or changing an ID, showing a rider's stats, deciding which race category they fit, searching for a person, and fetching a help article are different actions. A call about the same person is still wrong when it does a different action.

Reply with only JSON: {"fulfills": true} or {"fulfills": false}.
fulfills is true when this call does something they asked for. It can be true even if another tool is also needed.
A lookup that finds what the requested action needs is part of that action: for example asking the helper which route an event uses, so its profile can be posted.
fulfills is false only when this call would do a different action than the one they asked for.`;

function fulfillmentUserContent({ userText, name, description, args, context = "" }) {
  const recent = String(context || "").trim();
  return [
    ...(recent ? ["Recent conversation, oldest first:", recent, ""] : []),
    "User message:",
    String(userText || ""),
    "",
    `Proposed tool: ${name}`,
    `What it does: ${description}`,
    `Arguments: ${typeof args === "string" ? args : JSON.stringify(args || {})}`,
  ].join("\n");
}

/**
 * The visible messages just before the latest user message, so a follow-up can be judged.
 * Plain-text user and assistant messages only, each cut short.
 */
function recentConversation(input, { messages = 2, maxChars = 600 } = {}) {
  const rows = (Array.isArray(input) ? input : [])
    .filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.content === "string" && item.content.trim());
  const lastUser = rows.map((item) => item.role).lastIndexOf("user");
  if (lastUser <= 0) return "";
  return rows
    .slice(Math.max(0, lastUser - messages), lastUser)
    .map((item) => {
      const text = item.content.trim();
      return `${item.role}: ${text.length > maxChars ? `${text.slice(0, maxChars)}…` : text}`;
    })
    .join("\n");
}

function parseFulfillment(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed?.fulfills === "boolean") return parsed.fulfills;
    if (parsed?.fulfills === "true") return true;
    if (parsed?.fulfills === "false") return false;
    return null;
  } catch {
    return null;
  }
}

/**
 * verdictById maps a tool call id to true, false, or null/undefined.
 * Only an explicit false rejects. Everything else is allowed.
 */
function partitionByFulfillment(toolCalls, verdictById) {
  const accepted = [];
  const rejected = [];
  const newlyRejected = [];
  for (const toolCall of toolCalls || []) {
    if (verdictById.get(toolCall.id) === false) {
      rejected.push(toolCall);
      if (toolCall.name) newlyRejected.push(toolCall.name);
    } else {
      accepted.push(toolCall);
    }
  }
  return { accepted, rejected, newlyRejected };
}

function unmetToolOutput(name, description) {
  return JSON.stringify({
    success: false,
    executed: false,
    message:
      `Not run, and nothing was shown to the user. ${name} would do this instead: ${description} ` +
      `That is a different action from the one they asked for. Call the tool that does what they asked. ` +
      `Do not call ${name} again for this message.`,
  });
}

module.exports = {
  FULFILLMENT_INSTRUCTIONS,
  fulfillmentUserContent,
  recentConversation,
  parseFulfillment,
  partitionByFulfillment,
  unmetToolOutput,
};
