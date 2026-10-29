/** In-memory Firestore for the announcer tests: docs, merge writes, add, where-in and transactions. */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function deepMerge(base, patch) {
  const out = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}

function fakeDb() {
  const docs = new Map();
  let auto = 0;
  const snap = (key) => ({ exists: docs.has(key), id: key.split("/").pop(), data: () => docs.get(key) });
  const write = (key, data, options) => docs.set(key, options?.merge ? deepMerge(docs.get(key), data) : { ...data });
  const ref = (name, id) => {
    const key = `${name}/${id}`;
    return { key, id, get: async () => snap(key), set: async (data, options) => write(key, data, options) };
  };
  const inCollection = (name) => [...docs.keys()].filter((key) => key.startsWith(`${name}/`));
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ref(name, id),
      add: async (data) => { const r = ref(name, `d${++auto}`); write(r.key, data); return r; },
      get: async () => ({ docs: inCollection(name).map(snap) }),
      where: (field, op, values) => ({
        get: async () => ({
          docs: inCollection(name).map(snap).filter((doc) => (op === "in" ? values.includes(doc.data()[field]) : doc.data()[field] === values)),
        }),
      }),
    }),
    runTransaction: async (fn) => {
      const ops = [];
      const result = await fn({ get: async (r) => snap(r.key), set: (r, data, options) => ops.push([r.key, data, options]) });
      ops.forEach((op) => write(...op));
      return result;
    },
  };
}

module.exports = { fakeDb };
