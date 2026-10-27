// Firestore-shaped transactional test double: serializable commits, create preconditions,
// read-before-write enforcement, and rollback. Never initializes Firebase or reads credentials.
function memoryDb() {
  const documents = new Map();
  let tail = Promise.resolve();
  const copy = (data) => data === undefined ? undefined : structuredClone(data);
  const snapshot = (ref, data) => ({ id: ref.id, ref, exists: data !== undefined, data: () => copy(data) });
  const collection = () => ({
    doc(id) {
      const ref = { id, async get() { return snapshot(ref, documents.get(id)); } };
      return ref;
    },
    where(field, op, value) {
      if (op !== "==") throw new Error("unsupported_query");
      return { async get() {
        return { docs: [...documents].filter(([, data]) => data[field] === value).map(([id, data]) => snapshot({ id }, data)) };
      } };
    },
  });
  return { documents, collection,
    runTransaction(fn) {
      const result = tail.then(async () => {
        const working = new Map([...documents].map(([id, data]) => [id, copy(data)]));
        let wrote = false;
        const tx = {
          async get(ref) { if (wrote) throw new Error("read_after_write"); return snapshot(ref, working.get(ref.id)); },
          set(ref, data) { wrote = true; working.set(ref.id, copy(data)); },
          update(ref, data) { if (!working.has(ref.id)) throw new Error("missing_document"); wrote = true; working.set(ref.id, { ...working.get(ref.id), ...copy(data) }); },
          create(ref, data) { if (working.has(ref.id)) throw new Error("already_exists"); tx.set(ref, data); },
          delete(ref) { wrote = true; working.delete(ref.id); },
        };
        const value = await fn(tx);
        documents.clear();
        for (const [id, data] of working) documents.set(id, data);
        return value;
      });
      tail = result.catch(() => {});
      return result;
    } };
}

module.exports = { memoryDb };
