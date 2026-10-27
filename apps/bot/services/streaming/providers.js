const { StreamingError, parseChannel, youtubeLive } = require("./model");

// All outbound URLs are built here from validated IDs. No OBS/provider credentials cross to Discord.
function createProviders({ youtubeApiKey, twitchClientId, twitchClientSecret }, { fetchImpl = fetch, now = Date.now } = {}) {
  let twitchToken = null;
  let tokenRequest = null;

  async function request(url, options = {}) {
    let response;
    try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000) }); }
    catch { throw new StreamingError("provider_unavailable", "Streamingtjenesten svarer ikke. Prøv igen senere.", 503); }
    if (!response.ok) {
      throw new StreamingError(response.status === 429 || response.status === 403 ? "provider_quota" : "provider_unavailable",
        "Streamingtjenesten kunne ikke kontaktes. En admin kan kontrollere API-opsætningen.", 503);
    }
    return response.json();
  }

  function requireConfigured(platform) {
    if (platform === "youtube" ? !youtubeApiKey : !twitchClientId || !twitchClientSecret) {
      throw new StreamingError("provider_not_configured", `${platform === "youtube" ? "YouTube" : "Twitch"} er ikke konfigureret på DZR endnu. Kontakt en admin.`, 503);
    }
  }

  async function youtube(resource, params) {
    requireConfigured("youtube");
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    url.search = new URLSearchParams({ ...params, key: youtubeApiKey }).toString();
    return request(url);
  }

  async function accessToken() {
    requireConfigured("twitch");
    if (twitchToken && twitchToken.expiresAt > now() + 60_000) return twitchToken.value;
    if (!tokenRequest) {
      tokenRequest = request("https://id.twitch.tv/oauth2/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: twitchClientId, client_secret: twitchClientSecret, grant_type: "client_credentials" }).toString(),
      }).then((data) => {
        if (!data.access_token) throw new StreamingError("provider_unavailable", "Twitch-login mislykkedes.", 503);
        twitchToken = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
        return twitchToken.value;
      }).finally(() => { tokenRequest = null; });
    }
    return tokenRequest;
  }

  async function twitch(resource, params) {
    const url = new URL(`https://api.twitch.tv/helix/${resource}`);
    url.search = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken();
      let response;
      try { response = await fetchImpl(url, { headers: { "Client-Id": twitchClientId, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }); }
      catch { throw new StreamingError("provider_unavailable", "Twitch svarer ikke.", 503); }
      if (response.status === 401 && attempt === 0) { twitchToken = null; continue; }
      if (!response.ok) throw new StreamingError("provider_unavailable", "Twitch kunne ikke kontaktes.", 503);
      return response.json();
    }
  }

  async function resolveChannel(platform, input) {
    const parsed = parseChannel(platform, input);
    if (!parsed) return null;
    requireConfigured(platform);
    if (platform === "twitch") {
      const user = (await twitch("users", { login: parsed.login }))?.data?.[0];
      if (user && /^\d+$/.test(user.id)) return { id: user.id, title: user.display_name, url: `https://www.twitch.tv/${user.login}` };
    } else {
      const channel = (await youtube("channels", { part: "snippet", ...(parsed.id ? { id: parsed.id } : { forHandle: parsed.handle }) }))?.items?.[0];
      if (channel && /^UC[A-Za-z0-9_-]{22}$/.test(channel.id)) return { id: channel.id, title: channel.snippet.title, url: `https://www.youtube.com/channel/${channel.id}` };
    }
    throw new StreamingError("channel_not_found", "Kanalen blev ikke fundet. Kontrollér link eller kanalnavn.");
  }

  // quota.reserveSearch is persistent and shared by every worker/registration, before each search call.
  async function verify(channel, session, quota) {
    if (session.platform === "twitch") {
      const streams = (await twitch("streams", { user_id: channel.id, type: "live" }))?.data || [];
      const stream = streams.find((item) => item.user_id === channel.id && item.type === "live");
      return { streams: stream ? [{ platform: "twitch", id: stream.id, title: stream.title,
        startedAt: new Date(stream.started_at).toISOString(), url: channel.url }] : [], state: {} };
    }
    const state = { candidateIds: session.candidateIds || [], nextSearchAt: session.nextSearchAt || 0,
      upcomingSearched: session.upcomingSearched || false };
    const found = [];
    async function checkVideos(ids) {
      if (!ids.length) return;
      const videos = (await youtube("videos", { part: "snippet,status,liveStreamingDetails", id: ids.join(",") }))?.items || [];
      state.candidateIds = videos.filter((video) => video.snippet?.channelId === channel.id
        && !video.liveStreamingDetails?.actualEndTime && ["upcoming", "live"].includes(video.snippet?.liveBroadcastContent))
        .map((video) => video.id).slice(0, 20);
      for (const video of videos) if (youtubeLive(video, channel.id)) {
        found.push({ platform: "youtube", id: video.id, title: video.snippet.title,
          startedAt: new Date(video.liveStreamingDetails.actualStartTime).toISOString(), url: `https://www.youtube.com/watch?v=${video.id}` });
      }
    }
    await checkVideos(session.videoId ? [session.videoId] : state.candidateIds);
    if (!session.videoId && !found.length && now() >= state.nextSearchAt) {
      // Search only after an OBS signal: once/minute initially, then once/two minutes.
      state.nextSearchAt = now() + (now() - session.startedAt < 300_000 ? 60_000 : 120_000);
      if (await quota.reserveSearch()) {
        const result = await youtube("search", { part: "snippet", channelId: channel.id, type: "video", eventType: "live", maxResults: "10" });
        const ids = [...new Set([...state.candidateIds, ...(result.items || []).map((item) => item.id?.videoId).filter(Boolean)])];
        await checkVideos(ids);
        // OBS may send to YouTube's preview before Go Live. Discover upcoming IDs once,
        // then cheaply watch their actual status; a schedule never causes an announcement.
        if (!found.length && !state.candidateIds.length && !state.upcomingSearched && await quota.reserveSearch()) {
          state.upcomingSearched = true;
          const upcoming = await youtube("search", { part: "snippet", channelId: channel.id, type: "video", eventType: "upcoming", maxResults: "10" });
          await checkVideos((upcoming.items || []).map((item) => item.id?.videoId).filter(Boolean));
        }
      } else {
        return { streams: found, state, error: "youtube_search_budget" };
      }
    }
    return { streams: found, state };
  }

  return { resolveChannel, verify, requireConfigured };
}

module.exports = { createProviders };
