const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublisher } = require("./publisher");

test("publication uses a stable nonce; recovery matches the bot, URL and actual start", async () => {
  const notice = { channelId: "channel", nonce: "stable-stream-nonce", firstAttemptAt: 100000,
    stream: { url: "https://twitch.tv/dzr", startedAt: "2026-10-27T18:00:00.000Z" } };
  let sent;
  const channel = { guild_id: "guild", type: 0 };
  const rest = { async post(_route, payload) { sent = payload.body; return { id: "message" }; },
    async get(route) { return route.endsWith("/messages") ? [
      { id: "wrong-author", author: { id: "someone" }, embeds: [{ url: notice.stream.url, timestamp: notice.stream.startedAt }], timestamp: "2026-10-27T18:00:01.000Z" },
      { id: "right", author: { id: "bot" }, embeds: [{ url: notice.stream.url, timestamp: notice.stream.startedAt }], timestamp: "2026-10-27T18:00:01.000Z" },
    ] : channel; } };
  const publisher = createPublisher({ user: { id: "bot" } }, "guild", { rest });
  assert.equal(await publisher.send(notice, { content: "Live" }), "message");
  assert.equal(sent.enforce_nonce, true);
  assert.equal(sent.nonce, notice.nonce);
  assert.equal((await publisher.findExisting(notice)).messageId, "right");
  channel.guild_id = "other-guild";
  await assert.rejects(publisher.send(notice, {}), /invalid_streaming_channel/);
});

test("IT reports resolve #it inside the configured guild and send only sanitized fields without pings", async () => {
  const sent = [];
  const rest = { async get(route) {
    if (route === "/guilds/guild/channels") return [{ id: "it-channel", name: "it", type: 0 }, { id: "chat", name: "general", type: 0 }];
    assert.equal(route, "/channels/it-channel");
    return { guild_id: "guild", type: 0 };
  }, async post(route, payload) { sent.push({ route, body: payload.body }); } };
  const publisher = createPublisher({}, "guild", { rest });
  await publisher.reportError({ id: "alert_test", discordId: "member", code: "provider_unavailable", createdAt: 1793124000000, secret: "must-not-leak" });
  assert.equal(sent[0].route, "/channels/it-channel/messages");
  assert.deepEqual(sent[0].body.allowed_mentions, { parse: [] });
  assert.match(sent[0].body.content, /provider_unavailable/);
  assert.ok(!JSON.stringify(sent).includes("must-not-leak"));
});

test("ambiguous #it lookup fails closed rather than reporting to an arbitrary channel", async () => {
  const publisher = createPublisher({}, "guild", { rest: {
    async get() { return [{ id: "one", name: "it", type: 0 }, { id: "two", name: "it", type: 0 }]; },
    async post() { assert.fail(); },
  } });
  await assert.rejects(publisher.reportError({}), /streaming_it_channel_not_found/);
});
