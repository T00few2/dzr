const test = require("node:test");
const assert = require("node:assert/strict");
const { createProviders } = require("./providers");

const channel = { id: "UCaaaaaaaaaaaaaaaaaaaaaa", url: "https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa" };
const video = { id: "abcdefghijk", snippet: { channelId: channel.id, title: "Racing", liveBroadcastContent: "live" },
  status: { privacyStatus: "public" }, liveStreamingDetails: { actualStartTime: "2026-10-27T18:00:00Z" } };
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return body; } });

test("a supplied YouTube video ID bypasses search and verifies channel, visibility and actual start", async () => {
  let item = video;
  const urls = [];
  const providers = createProviders({ youtubeApiKey: "test-key" }, { fetchImpl: async (url) => { urls.push(url); return json({ items: [item] }); } });
  const session = { platform: "youtube", videoId: video.id };
  const quota = { reserveSearch() { assert.fail("No search for known IDs"); } };
  assert.equal((await providers.verify(channel, session, quota)).streams.length, 1);
  item = { ...video, snippet: { ...video.snippet, channelId: "someone_else" } };
  assert.equal((await providers.verify(channel, session, quota)).streams.length, 0);
  item = { ...video, snippet: { ...video.snippet, liveBroadcastContent: "upcoming" }, liveStreamingDetails: {} };
  assert.equal((await providers.verify(channel, session, quota)).streams.length, 0);
  assert.ok(urls.every((url) => url.pathname.endsWith("/videos")));
});

test("YouTube discovery is callback-triggered, quota reserved, then video status checked", async () => {
  const order = [];
  const providers = createProviders({ youtubeApiKey: "test-key" }, { now: () => 1000000, fetchImpl: async (url) => {
    order.push(url.pathname.split("/").pop());
    if (url.pathname.endsWith("/search")) {
      assert.equal(url.searchParams.get("channelId"), channel.id);
      assert.equal(url.searchParams.get("eventType"), "live");
      return json({ items: [{ id: { videoId: video.id } }] });
    }
    return json({ items: [video] });
  } });
  const result = await providers.verify(channel, { platform: "youtube", startedAt: 1000000 }, { async reserveSearch() { order.push("reserve"); return true; } });
  assert.deepEqual(order, ["reserve", "search", "videos"]);
  assert.equal(result.streams[0].url, `https://www.youtube.com/watch?v=${video.id}`);
  assert.equal(result.state.nextSearchAt, 1060000);
});

test("exhausted budget and nextSearchAt prevent requests; known videos still get checked", async () => {
  let calls = 0;
  const providers = createProviders({ youtubeApiKey: "test-key" }, { now: () => 1000000, fetchImpl: async () => { calls++; return json({ items: [] }); } });
  const result = await providers.verify(channel, { platform: "youtube", startedAt: 1000000 }, { async reserveSearch() { return false; } });
  assert.equal(result.error, "youtube_search_budget");
  assert.equal(calls, 0);
  await providers.verify(channel, { platform: "youtube", nextSearchAt: 1060000 }, { reserveSearch() { assert.fail(); } });
  assert.equal(calls, 0);
});

test("a scheduled preview is discovered once, then cheap video polling detects its actual start", async () => {
  let time = 1000000, live = false, searches = 0;
  const providers = createProviders({ youtubeApiKey: "test-key" }, { now: () => time, fetchImpl: async (url) => {
    if (url.pathname.endsWith("/search")) {
      searches++;
      return json({ items: url.searchParams.get("eventType") === "upcoming" ? [{ id: { videoId: video.id } }] : [] });
    }
    return json({ items: [live ? video : { ...video, snippet: { ...video.snippet, liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: "2026-10-27T18:00:00Z" } }] });
  } });
  const session = { platform: "youtube", startedAt: time };
  const quota = { async reserveSearch() { return true; } };
  const first = await providers.verify(channel, session, quota);
  assert.equal(first.streams.length, 0);
  assert.deepEqual(first.state.candidateIds, [video.id]);
  live = true; time += 20000;
  assert.equal((await providers.verify(channel, { ...session, ...first.state }, quota)).streams.length, 1);
  assert.equal(searches, 2);
});

test("channel resolution uses the handle endpoint, never a quota-expensive search", async () => {
  const providers = createProviders({ youtubeApiKey: "test-key" }, { fetchImpl: async (url) => {
    assert.ok(url.pathname.endsWith("/channels"));
    assert.equal(url.searchParams.get("forHandle"), "@DZR");
    return json({ items: [{ id: channel.id, snippet: { title: "DZR" } }] });
  } });
  assert.equal((await providers.resolveChannel("youtube", "@DZR")).id, channel.id);
  await assert.rejects(providers.resolveChannel("twitch", "dzr"), { code: "provider_not_configured" });
});

test("Twitch app tokens are cached, and only the registered live broadcaster is accepted", async () => {
  let tokens = 0;
  const providers = createProviders({ twitchClientId: "client", twitchClientSecret: "secret" }, { fetchImpl: async (url, options) => {
    if (String(url).includes("oauth2/token")) { tokens++; assert.ok(options.body.includes("client_secret=secret")); return json({ access_token: "token", expires_in: 3600 }); }
    assert.equal(options.headers.Authorization, "Bearer token");
    assert.equal(url.searchParams.get("user_id"), "1234");
    return json({ data: [{ id: "stream1", user_id: "1234", type: "live", title: "Racing", started_at: "2026-10-27T18:00:00Z" }] });
  } });
  const twitch = { id: "1234", url: "https://www.twitch.tv/dzr" };
  assert.equal((await providers.verify(twitch, { platform: "twitch" }, {})).streams[0].id, "stream1");
  await providers.verify(twitch, { platform: "twitch" }, {});
  assert.equal(tokens, 1);
});

test("provider errors never retain request headers, URLs or credentials", async () => {
  const providers = createProviders({ youtubeApiKey: "do-not-leak" }, { fetchImpl: async () => { throw new Error("URL contains do-not-leak"); } });
  await assert.rejects(providers.resolveChannel("youtube", "@DZR"), (error) => {
    assert.equal(error.code, "provider_unavailable");
    assert.ok(!JSON.stringify(error).includes("do-not-leak"));
    assert.ok(!error.stack.includes("do-not-leak"));
    return true;
  });
});
