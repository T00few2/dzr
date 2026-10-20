const test = require("node:test");
const assert = require("node:assert/strict");

const { claimChatTurn } = require("./turnClaim");

/** Minimal Firestore stand-in whose create() fails like the real one when the doc exists. */
function fakeDb({ fail } = {}) {
  const docs = new Map();
  return {
    docs,
    collection: (name) => ({
      doc: (id) => ({
        create: async (data) => {
          if (fail) throw fail;
          const key = `${name}/${id}`;
          if (docs.has(key)) {
            const error = new Error("6 ALREADY_EXISTS: Document already exists");
            error.code = 6;
            throw error;
          }
          docs.set(key, data);
        },
      }),
    }),
  };
}

test("only the first process to claim a message answers it", async () => {
  const db = fakeDb();
  assert.equal(await claimChatTurn(db, { botId: "b", messageId: "m1" }), true);
  assert.equal(await claimChatTurn(db, { botId: "b", messageId: "m1" }), false);
  assert.equal(await claimChatTurn(db, { botId: "b", messageId: "m2" }), true);
});

test("the club bot and Coach claim separately", async () => {
  const db = fakeDb();
  assert.equal(await claimChatTurn(db, { botId: "club", messageId: "m1" }), true);
  assert.equal(await claimChatTurn(db, { botId: "coach", messageId: "m1" }), true);
});

test("answers anyway when Firestore is unavailable", async () => {
  const db = fakeDb({ fail: Object.assign(new Error("14 UNAVAILABLE"), { code: 14 }) });
  assert.equal(await claimChatTurn(db, { botId: "b", messageId: "m1" }), true);
});
