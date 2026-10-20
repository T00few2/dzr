// Remembers which ladder previews and reminders were already posted, so a restart never posts twice.
const { createStore } = require("./ladderStore");

const MAX_IDS = 200;
const store = createStore("state", () => ({}));

async function isPosted(type, id) {
  return ((await store.load())[type] || []).includes(String(id));
}

async function markPosted(type, id) {
  const state = await store.load();
  const ids = state[type] || [];
  if (ids.includes(String(id))) return;
  state[type] = [...ids, String(id)].slice(-MAX_IDS);
  await store.persist();
}

module.exports = { isPosted, markPosted };
