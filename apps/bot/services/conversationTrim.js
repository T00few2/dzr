const MAX_CONVERSATION_LENGTH = 20; // Last 20 messages (10 exchanges)

/**
 * Trim chat history to the last `maxMessages` messages, always keeping the system prompt.
 *
 * A plain positional slice is unsafe. Tool results follow the assistant message that requested
 * them, so a cut landing between the two keeps a `tool` message whose `tool_calls` parent has
 * been dropped. OpenAI rejects that request with "messages with role 'tool' must be a response
 * to a preceding message with tool_calls". One of the call sites trims mid-turn, so the athlete
 * sees the generic error reply rather than their coaching answer.
 *
 * Anchoring the retained window on a `user` turn cannot split a tool-call group, because a group
 * is always assistant-then-tools with no user message inside it.
 *
 * Kept in its own module with no side effects at import time so it can be unit tested —
 * requiring aiChatHandler pulls in Firebase and OpenAI initialisation.
 */
function trimConversation(conversation, maxMessages = MAX_CONVERSATION_LENGTH) {
  if (!Array.isArray(conversation) || conversation.length <= maxMessages + 1) {
    return conversation;
  }
  const [system, ...rest] = conversation;

  let start = Math.max(0, rest.length - maxMessages);
  while (start < rest.length && rest[start]?.role !== "user") start++;

  if (start >= rest.length) {
    // No user turn inside the window — fall back to the most recent one anywhere, so the result
    // never begins on an orphaned tool result.
    start = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (rest[i]?.role === "user") {
        start = i;
        break;
      }
    }
  }

  return [system, ...rest.slice(start)];
}

module.exports = { trimConversation, MAX_CONVERSATION_LENGTH };
