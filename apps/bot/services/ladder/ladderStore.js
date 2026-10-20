// Small in-memory stores backed by one Firestore document each in the `ladder_bot` collection.
// The data is kept as a JSON string so team names and ids never clash with Firestore field rules.
const COLLECTION = "ladder_bot";

function firestoreBackend(name) {
  // Required lazily: services/firebase.js throws without the Firebase env vars, which would break unit tests.
  const { db } = require("../firebase");
  const doc = db.collection(COLLECTION).doc(name);
  return {
    async read() {
      const snap = await doc.get();
      return snap.exists ? JSON.parse(snap.data().json) : undefined;
    },
    async write(data) {
      await doc.set({ json: JSON.stringify(data), updatedAt: new Date().toISOString() });
    },
  };
}

function createStore(name, fallback, backend) {
  let data = fallback();
  let loading = null;
  let queue = Promise.resolve();
  const getBackend = () => {
    backend = backend || firestoreBackend(name);
    return backend;
  };

  return {
    name,
    // Reads the document once and serves from memory afterwards; a failed read is retried on the next call.
    load() {
      if (!loading) {
        loading = getBackend()
          .read()
          .then((stored) => {
            if (stored !== undefined) data = stored;
            return data;
          })
          .catch((err) => {
            loading = null;
            throw err;
          });
      }
      return loading;
    },
    get: () => data,
    set(next) {
      data = next;
    },
    // Writes are serialised so a slow write never overtakes a newer one.
    persist() {
      const snapshot = JSON.parse(JSON.stringify(data));
      queue = queue
        .then(() => getBackend().write(snapshot))
        .catch((err) => console.error(`[ladderStore:${name}] Could not save:`, err.message));
      return queue;
    },
  };
}

module.exports = { createStore };
