const { listCoachProfiles, getBotState, setBotState } = require("./firebase");
const strava = require("./stravaService");
const { shouldRunFollowUpSweep } = require("./coachFollowUpSchedule");

const STATE_KEY = "coach_weekly_load";
// The whole club shares one Strava rate limit, so refresh a slice of athletes per night rather
// than everyone at once. With a 26-week window each athlete costs one to two requests.
const MAX_ATHLETES_PER_RUN = 8;
const PAUSE_BETWEEN_ATHLETES_MS = 2000;
const REFRESH_EVERY_MS = 3 * 86400000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function staleness(profile, stored) {
  const updated = stored?.updatedAt ? Date.parse(stored.updatedAt) : NaN;
  if (!Number.isFinite(updated)) return Infinity; // never built — highest priority
  return Date.now() - updated;
}

/**
 * Nightly weekly-load refresh.
 *
 * Reuses the follow-up window logic so it runs once per day on the first tick at or after 08:00
 * and never late in the evening. Athletes are processed oldest-rollup-first, a few per night, so
 * the initial backfill spreads over several days instead of hammering the shared Strava quota in
 * one burst — the plan's stated risk was the first run, not the steady state.
 */
async function maybeRefreshWeeklyLoad(now = new Date()) {
  const existing = await getBotState(STATE_KEY);
  const decision = shouldRunFollowUpSweep({ now, lastRunDate: existing?.lastRunDate || null });
  if (!decision.run) return { skipped: decision.reason };

  let candidates = [];
  try {
    const profiles = await listCoachProfiles();
    const withStaleness = [];
    for (const profile of profiles) {
      const discordId = String(profile.discordId || "").trim();
      if (!discordId) continue;
      const stored = await strava.getWeeklyLoad(discordId);
      const age = staleness(profile, stored);
      if (age < REFRESH_EVERY_MS) continue;
      withStaleness.push({ discordId, age });
    }
    candidates = withStaleness.sort((a, b) => b.age - a.age).slice(0, MAX_ATHLETES_PER_RUN);
  } catch (err) {
    console.error("weekly load: could not list profiles:", err?.message || err);
    return { skipped: "list_failed" };
  }

  let refreshed = 0;
  for (const { discordId } of candidates) {
    try {
      const [member, connected] = await Promise.all([
        strava.hasClubMemberRole(discordId),
        strava.isStravaConnected(discordId),
      ]);
      if (!member || !connected) continue;
      const result = await strava.refreshWeeklyLoad(discordId);
      if (result?.success) refreshed += 1;
    } catch (err) {
      console.warn("weekly load refresh failed:", discordId, err?.message || err);
    }
    await sleep(PAUSE_BETWEEN_ATHLETES_MS);
  }

  await setBotState(STATE_KEY, {
    lastRunDate: decision.todayKey,
    refreshed,
    considered: candidates.length,
    updatedAt: now.toISOString(),
  });
  console.log(`📈 Coach weekly load: refreshed ${refreshed}/${candidates.length} on ${decision.todayKey}`);
  return { refreshed, considered: candidates.length };
}

module.exports = { maybeRefreshWeeklyLoad, MAX_ATHLETES_PER_RUN, REFRESH_EVERY_MS };
