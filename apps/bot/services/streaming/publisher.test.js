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
