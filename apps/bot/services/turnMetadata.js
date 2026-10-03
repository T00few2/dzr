/**
 * Short-lived, in-memory lookup from a coach reply's Discord message id to how that reply was
 * made (tools called, reasoning effort, model), so a 👍/👎 can be tied to it.
 *
 * Holds no message text. Bounded by count and age so it cannot grow without limit; a reaction
 * after a restart or a day later simply gets no metadata. Pure, so it can be unit tested.
 */
function createTurnMetadataStore({ maxEntries = 1000, maxAgeMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const entries = new Map();

  function prune() {
    const cutoff = now() - maxAgeMs;
    for (const [id, entry] of entries) {
      if (entry.at >= cutoff && entries.size <= maxEntries) break;
      entries.delete(id);
    }
  }

  function remember(messageIds, meta) {
    const ids = (Array.isArray(messageIds) ? messageIds : [messageIds]).filter(Boolean).map(String);
    if (!ids.length) return;
    const entry = { meta: { ...meta }, at: now() };
    for (const id of ids) {
      entries.delete(id);
      entries.set(id, entry);
    }
    prune();
  }

  function lookup(messageId) {
    const entry = entries.get(String(messageId || ""));
    if (!entry) return null;
    if (now() - entry.at > maxAgeMs) {
      entries.delete(String(messageId));
      return null;
    }
    return { ...entry.meta };
  }

  return { remember, lookup, size: () => entries.size };
}

module.exports = { createTurnMetadataStore };
