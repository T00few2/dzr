const test = require("node:test");
const assert = require("node:assert/strict");

/** tokenCrypto reads the key from process.env lazily, so reload it per key setup. */
function loadWithKey(key) {
  delete require.cache[require.resolve("./tokenCrypto")];
  process.env.COACH_MEMORY_KEY = key ?? "";
  process.env.STRAVA_CONNECT_SECRET = key ?? "";
  process.env.STRAVA_TOKEN_KEY = "";
  return require("./tokenCrypto");
}

test("coach memory round-trips under the same key", () => {
  const tc = loadWithKey("key-one");
  const doc = tc.persistCoachMemoryDoc({ discordId: "1", sports: ["cycling"], notesOptIn: true });
  assert.match(String(doc.memoryEnc), /^enc:v1:/);
  const back = tc.unwrapCoachMemoryDoc(doc);
  assert.deepEqual(back.sports, ["cycling"]);
  assert.equal(back.notesOptIn, true);
});

test("refuses to write coach memory with no key rather than storing plaintext", () => {
  const tc = loadWithKey("");
  assert.throws(() => tc.persistCoachMemoryDoc({ discordId: "1", sports: ["cycling"] }), /Refusing to write/);
});

test("refuses to write chat notes with no key", () => {
  const tc = loadWithKey("");
  assert.throws(() => tc.persistChatNoteDoc({ discordId: "1", text: "felt ill", kind: "feeling" }), /Refusing to write/);
});

test("timestamps stay outside the ciphertext so they can be merge-written", () => {
  const tc = loadWithKey("key-one");
  const doc = tc.persistCoachMemoryDoc({
    discordId: "1",
    sports: ["cycling"],
    lastAthleteMessageAt: "2026-09-06T10:00:00.000Z",
  });
  // Stage 1a depends on this: stampCoachProfile writes these fields directly with update().
  assert.equal(doc.lastAthleteMessageAt, "2026-09-06T10:00:00.000Z");
});

test("canary detects a key that does not match the one that wrote it", () => {
  const a = loadWithKey("key-one");
  const canary = a.makeCoachCanary();
  assert.ok(a.verifyCoachCanary(canary), "same key should verify");

  const b = loadWithKey("key-two");
  assert.equal(b.verifyCoachCanary(canary), false, "different key must not verify");

  const none = loadWithKey("");
  assert.equal(none.verifyCoachCanary(canary), false, "no key must not verify");
});

test("decryption still passes through legacy plaintext values", () => {
  const tc = loadWithKey("key-one");
  // A document written before encryption existed: fields in the clear, no memoryEnc.
  const legacy = { discordId: "1", sports: ["running"], notesOptIn: false };
  assert.deepEqual(tc.unwrapCoachMemoryDoc(legacy).sports, ["running"]);
});

test("keyId is a short fingerprint that does not expose the key", () => {
  const tc = loadWithKey("a-very-secret-key");
  const id = tc.coachKeyId();
  assert.equal(typeof id, "string");
  assert.equal(id.length, 8);
  assert.ok(!id.includes("secret"), "must not contain the key material");
});

test("different keys produce different fingerprints", () => {
  const a = loadWithKey("key-one").coachKeyId();
  const b = loadWithKey("key-two").coachKeyId();
  assert.notEqual(a, b);
});

test("documents written before keyId existed still read", () => {
  const tc = loadWithKey("key-one");
  const doc = tc.persistCoachMemoryDoc({ discordId: "1", sports: ["cycling"] });
  delete doc.memoryKeyId; // simulate a document from before this field existed
  assert.deepEqual(tc.unwrapCoachMemoryDoc(doc).sports, ["cycling"], "a missing keyId must not fail the read");
});

test("compareKeyId distinguishes a rotated key from a legacy document", () => {
  const tc = loadWithKey("key-one");
  const current = tc.coachKeyId();
  assert.equal(tc.compareKeyId(current, current), "match");
  assert.equal(tc.compareKeyId("deadbeef", current), "mismatch", "a real key change");
  assert.equal(tc.compareKeyId(undefined, current), "unknown", "predates keyId, not a problem");
  assert.equal(tc.compareKeyId(current, null), "no_key");
});
