const test = require("node:test");
const assert = require("node:assert/strict");
const { memoryDb } = require("./test-support");
const { createStore } = require("./store");
const { createStreamingService } = require("./service");
const { tokenMatches } = require("./model");

const guildId = "1195850595014299669", userId = "111111111111111111", channelId = "1196454773558345768";
const channel = { id: "UCaaaaaaaaaaaaaaaaaaaaaa", title: "DZR", url: "https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa" };
const stream = { platform: "youtube", id: "abcdefghijk", title: "Live", url: "https://www.youtube.com/watch?v=abcdefghijk", startedAt: "2026-10-27T18:00:00.000Z" };

function setup() {
  let time = Date.parse("2026-10-27T18:00:00Z");
  const db = memoryDb();
  const store = createStore(db, { now: () => time, searchBudget: 3 });
  const published = [];
  const providers = { async resolveChannel() { return channel; }, async verify() { return { streams: [stream], state: {} }; } };
  const publisher = { async send(notice, message) { published.push({ notice, message }); return "message-id"; },
    async findExisting() { return published.length ? { complete: true, messageId: "message-id" } : { complete: true }; } };
  const options = { store, providers, publisher, guildId, channelId, now: () => time, logger: { warn() {} } };
  const service = createStreamingService(options);
  return { db, store, providers, publisher, published, options, service,
    advance(ms) { time += ms; }, now: () => time,
    enroll: () => service.enroll(userId, "Rider", { youtube: "@DZR" }),
    event: (overrides = {}) => ({ event: "started", platform: "youtube", sessionId: "session_1234567890", sequence: 1, startedAt: time, sentAt: time, ...overrides }) };
}

test("onboarding stores only a hash; testing never announces or sets last-live", async () => {
  const s = setup(); const { token } = await s.enroll();
  const registration = await s.service.getRegistration(userId);
  assert.ok(tokenMatches(token, registration.tokenHash));
  assert.ok(!JSON.stringify([...s.db.documents]).includes(token));
  await s.service.callback(token, s.event({ event: "test" }));
  await s.service.tick();
  assert.equal(s.published.length, 0);
  assert.equal((await s.service.getRegistration(userId)).lastLiveAt, null);
  assert.equal((await s.service.getRegistration(userId)).lastCallbackAt, s.now());
});

test("a verified stream is announced once across repeated callbacks, new OBS sessions and bot restarts", async () => {
  const s = setup(); const { token } = await s.enroll();
  const started = s.event();
  await s.service.callback(token, started);
  await Promise.all([s.service.tick(), s.service.tick()]);
  await s.service.callback(token, started);
  s.advance(10_000);
  await s.service.callback(token, s.event({ sessionId: "new_session_1234567890" }));
  await createStreamingService(s.options).tick();
  assert.equal(s.published.length, 1);
  assert.equal((await s.service.getRegistration(userId)).lastLiveAt, Date.parse(stream.startedAt));
  assert.equal(s.published[0].notice.channelId, channelId);
});

test("two bot workers sharing Firestore cannot announce the same stream twice", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  await Promise.all([s.service.tick(), createStreamingService(s.options).tick()]);
  assert.equal(s.published.length, 1);
});

test("upcoming, private and offline results cannot announce even after OBS starts", async () => {
  const s = setup(); const { token } = await s.enroll();
  s.providers.verify = async () => ({ streams: [], state: {} });
  await s.service.callback(token, s.event());
  await s.service.tick();
  assert.equal(s.published.length, 0);
  assert.equal((await s.service.getRegistration(userId)).lastLiveAt, null);
});

test("rotating the key cancels previous sessions and denies the old key immediately", async () => {
  const s = setup(); const first = await s.enroll();
  await s.service.callback(first.token, s.event());
  const second = await s.enroll();
  await assert.rejects(s.service.callback(first.token, s.event()), { code: "invalid_key" });
  await s.service.tick();
  assert.equal(s.published.length, 0);
  assert.notEqual(first.token, second.token);
});

test("remove during provider verification cannot enqueue or publish a notice", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  s.providers.verify = async () => { await s.service.remove(userId); return { streams: [stream] }; };
  await s.service.tick();
  assert.equal(s.published.length, 0);
  assert.equal(await s.service.getRegistration(userId), null);
  await assert.rejects(s.service.callback(token, s.event()), { code: "invalid_key" });
});

test("out-of-order old-session events and post-stop heartbeats do not reactivate monitoring", async () => {
  const s = setup(); const { token } = await s.enroll();
  const first = s.event();
  await s.service.callback(token, first);
  s.advance(1000);
  const second = s.event({ sessionId: "second_session_12345" });
  await s.service.callback(token, second);
  await s.service.callback(token, { ...first, event: "stopped", sequence: 5, sentAt: s.now() });
  assert.equal((await s.store.listSessions())[0].sessionId, second.sessionId);
  await s.service.callback(token, { ...second, event: "stopped", sequence: 2 });
  await s.service.callback(token, { ...second, event: "heartbeat", sequence: 3 });
  assert.equal((await s.store.listSessions()).length, 0);
});

test("missing heartbeats expire durable sessions without posting", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  s.advance(151_000);
  await s.service.tick();
  assert.equal(s.published.length, 0);
  assert.equal((await s.store.listSessions()).length, 0);
});

test("a fresh heartbeat recovers an expired session after a bot/network outage", async () => {
  const s = setup(); const { token } = await s.enroll();
  const first = s.event();
  await s.service.callback(token, first);
  s.advance(151_000);
  await s.service.tick();
  await s.service.callback(token, { ...first, event: "heartbeat", sequence: 2, sentAt: s.now() });
  await s.service.tick();
  assert.equal(s.published.length, 1);
});

test("Discord accepted a message but the receipt failed: restart reconciles without sending again", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  const send = s.publisher.send;
  s.publisher.send = async (...args) => { await send(...args); throw new Error("connection_dropped_after_accept"); };
  await s.service.tick();
  s.advance(31_000);
  await createStreamingService(s.options).tick();
  assert.equal(s.published.length, 1);
  assert.equal((await s.store.listNotices()).length, 0);
});

test("ambiguous delivery with unavailable history never blindly resends", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  s.publisher.send = async () => { throw new Error("timeout"); };
  await s.service.tick();
  s.publisher.findExisting = async () => ({ complete: false });
  s.publisher.send = async () => { throw new Error("should_not_send"); };
  s.advance(31_000);
  await s.service.tick();
  assert.equal((await s.store.listNotices())[0].lastError, "discord_history_unavailable");
});

test("queued announcement is reverified and cancelled if the broadcast ended", async () => {
  const s = setup(); const { token } = await s.enroll();
  await s.service.callback(token, s.event());
  s.publisher.send = async () => { throw new Error("unavailable"); };
  await s.service.tick();
  s.providers.verify = async () => ({ streams: [], state: {} });
  s.advance(31_000);
  await s.service.tick();
  assert.equal((await s.store.listNotices()).length, 0);
});

test("channel claims prevent two members taking the same channel and release on removal", async () => {
  const s = setup(); await s.enroll();
  await assert.rejects(s.service.enroll("222222222222222222", "Other", { youtube: "@DZR" }), { code: "channel_in_use" });
  await s.service.remove(userId);
  await s.service.enroll("222222222222222222", "Other", { youtube: "@DZR" });
});

test("persistent YouTube search budget is shared by concurrent callers and resets at Pacific midnight", async () => {
  const s = setup();
  assert.equal((await Promise.all(Array.from({ length: 8 }, () => s.store.reserveSearch()))).filter(Boolean).length, 3);
  s.advance(86400_000);
  assert.equal(await s.store.reserveSearch(), true);
});

test("callbacks cannot select an unregistered platform or impersonate a different member", async () => {
  const s = setup(); const { token } = await s.enroll();
  await assert.rejects(s.service.callback(token, s.event({ platform: "twitch" })), { code: "channel_not_registered" });
  await assert.rejects(s.service.callback(token.replace(userId, "222222222222222222"), s.event()), { code: "invalid_key" });
});
