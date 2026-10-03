/**
 * Run async tasks one at a time per key.
 *
 * Two messages from the same athlete arriving close together used to run their turns
 * concurrently against the same conversation array, interleaving tool calls with the next user
 * message — which OpenAI rejects. Chaining per key makes each turn see the finished previous one.
 *
 * Pure, no imports, so it can be unit tested.
 */
function createTurnQueue({ maxWaiting = 3 } = {}) {
  const tails = new Map();
  const sizes = new Map();

  function size(key) {
    return sizes.get(key) || 0;
  }

  /**
   * Queue `task` behind any running turn for `key`. Returns the task's promise, or null when one
   * turn is running and `maxWaiting` more are already queued.
   */
  function tryEnqueue(key, task) {
    const current = size(key);
    if (current > maxWaiting) return null;
    sizes.set(key, current + 1);

    const previous = tails.get(key) || Promise.resolve();
    const run = previous.then(() => task());
    const settled = run.then(
      () => undefined,
      () => undefined
    ).then(() => {
      const remaining = size(key) - 1;
      if (remaining <= 0) {
        sizes.delete(key);
        if (tails.get(key) === settled) tails.delete(key);
      } else {
        sizes.set(key, remaining);
      }
    });
    tails.set(key, settled);
    return run;
  }

  return { tryEnqueue, size };
}

module.exports = { createTurnQueue };
