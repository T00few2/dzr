const test = require("node:test");
const assert = require("node:assert/strict");
const { parseChannel, parseEvent, youtubeLive, createToken, tokenOwner, tokenMatches, hash, announcementMessage } = require("./model");

test("channel identity parsing rejects watch URLs, spoofed hosts, credentials and arbitrary endpoints", () => {
  assert.deepEqual(parseChannel("youtube", "https://www.youtube.com/@DZR"), { handle: "@DZR" });
  assert.deepEqual(parseChannel("youtube", "https://youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/"), { id: "UCaaaaaaaaaaaaaaaaaaaaaa" });
  assert.deepEqual(parseChannel("twitch", "https://www.twitch.tv/DZR_Racing"), { login: "dzr_racing" });
  for (const url of ["https://youtube.com.evil.test/@DZR", "https://evil@youtube.com/@DZR", "https://youtube.com/watch?v=abcdefghijk", "http://127.0.0.1/@DZR", "https://youtube.com:8443/@DZR", "https://youtube.com/@DZR#secret"]) {
    assert.throws(() => parseChannel("youtube", url));
  }
});

test("public YouTube video must actually be live, in the registered channel", () => {
  const video = { snippet: { channelId: "channel", liveBroadcastContent: "live" }, status: { privacyStatus: "public" }, liveStreamingDetails: { actualStartTime: "2026-10-27T18:00:00Z" } };
  assert.ok(youtubeLive(video, "channel"));
  assert.equal(youtubeLive(video, "other"), false);
  for (const modified of [
    { ...video, snippet: { ...video.snippet, liveBroadcastContent: "upcoming" } },
    { ...video, liveStreamingDetails: { scheduledStartTime: "2026-10-27T18:00:00Z" } },
    { ...video, liveStreamingDetails: { ...video.liveStreamingDetails, actualEndTime: "2026-10-27T19:00:00Z" } },
    { ...video, status: { privacyStatus: "private" } },
    { ...video, status: { privacyStatus: "unlisted" } },
  ]) assert.ok(!youtubeLive(modified, "channel"));
});

test("personal keys are random, owner-bound and verified by hash", () => {
  const id = "111111111111111111";
  const token = createToken(id);
  assert.equal(tokenOwner(token), id);
  assert.equal(tokenMatches(token, hash(token)), true);
  assert.equal(tokenMatches(createToken(id), hash(token)), false);
  assert.equal(tokenMatches(token, "invalid"), false);
  assert.equal(tokenOwner("anything"), null);
});

test("callback events require bounded, ordered metadata and a fresh clock", () => {
  const now = Date.now();
  const event = { event: "started", platform: "youtube", sessionId: "session_1234567890", sequence: 1, startedAt: now, sentAt: now };
  assert.equal(parseEvent(event, now).videoId, null);
  for (const patch of [{ platform: "other" }, { sequence: -1 }, { sessionId: "../../x" }, { sentAt: now - 121000 }, { startedAt: now + 1 }, { videoId: "https://evil" }]) {
    assert.throws(() => parseEvent({ ...event, ...patch }, now));
  }
});

test("announcement contains verified stream URL, with all mentions disabled", () => {
  const payload = announcementMessage({ discordId: "111111111111111111" }, { title: "@everyone", platform: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", startedAt: "2026-10-27T18:00:00Z" });
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(payload.embeds[0].url, "https://www.youtube.com/watch?v=abcdefghijk");
});
