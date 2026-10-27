/**
 * What the model sees of a tool result. Fields not listed here are dropped (only short scalars
 * survive, under `extra`), so a new tool's payload key must be added or the model gets nothing.
 * Big payloads (e.g. teams arrays) quickly degrade model performance & cost.
 */
function compactToolResult(result) {
  if (!result || typeof result !== "object") return result;

  const base = {
    tool_call_id: result.tool_call_id,
    success: !!result.success,
  };

  if (typeof result.message === "string" && result.message.length > 0) {
    base.message = result.message.slice(0, 1000);
  }

  // Common payloads
  if (result.rider) {
    base.rider = result.rider;
  }
  if (result.team) {
    base.team = Array.isArray(result.team) ? result.team.slice(0, 8) : result.team;
    if (Array.isArray(result.team) && result.team.length > 8) base.team_truncated = true;
  }
  if (result.teams) {
    base.teams = Array.isArray(result.teams) ? result.teams.slice(0, 25) : result.teams;
    if (Array.isArray(result.teams) && result.teams.length > 25) base.teams_truncated = true;
  }
  if (typeof result.title === "string" || typeof result.content === "string") {
    base.title = typeof result.title === "string" ? result.title.slice(0, 200) : undefined;
    base.content = typeof result.content === "string" ? result.content.slice(0, 2000) : undefined;
    base.tags = Array.isArray(result.tags) ? result.tags.slice(0, 25) : undefined;
  }
  if (result.zwiftpower) base.zwiftpower = result.zwiftpower;
  if (result.athlete) base.athlete = result.athlete;
  if (result.stats) base.stats = result.stats;
  if (result.zones) base.zones = result.zones;
  if (Array.isArray(result.activities)) base.activities = result.activities;
  if (typeof result.oldest === "string") base.oldest = result.oldest.slice(0, 10);
  if (typeof result.newest === "string") base.newest = result.newest.slice(0, 10);
  if (result.activity) base.activity = result.activity;
  if (result.metrics) base.metrics = result.metrics;
  if (Array.isArray(result.wellness)) base.wellness = result.wellness;
  if (Array.isArray(result.fitness)) base.fitness = result.fitness;
  if (Array.isArray(result.workouts)) base.workouts = result.workouts;
  if (Array.isArray(result.curves)) base.curves = result.curves;
  if (typeof result.days === "number") base.days = result.days;
  if (result.needs_reconnect) base.needs_reconnect = true;
  if (result.scope_denied) base.scope_denied = true;
  if (result.not_club_member) base.not_club_member = true;
  if (typeof result.connectUrl === "string") base.connectUrl = result.connectUrl.slice(0, 500);
  if (result.metadata) base.metadata = result.metadata;
  if (result.series) base.series = result.series;
  if (Array.isArray(result.races)) base.races = result.races.slice(0, 12);
  if (typeof result.today === "string") base.today = result.today;
  // dcu_eserien_results: DZR riders per division (race and standings) and the club table
  if (Array.isArray(result.divisions)) base.divisions = result.divisions;
  if (Array.isArray(result.clubs)) base.clubs = result.clubs;
  if (typeof result.note === "string") base.note = result.note.slice(0, 500);
  if (result.zrl) base.zrl = result.zrl;
  // my_onboarding_status and club_overview
  if (result.onboarding) base.onboarding = result.onboarding;
  if (result.membership) base.membership = result.membership;
  if (typeof result.summary === "string") base.summary = result.summary;
  if (typeof result.coach_info === "string") base.coach_info = result.coach_info.slice(0, 4000);
  if (result.sent_full) base.sent_full = true;
  if (typeof result.confirmMessageDa === "string") base.confirmMessageDa = result.confirmMessageDa.slice(0, 1500);
  if (typeof result.confirmMessageEn === "string") base.confirmMessageEn = result.confirmMessageEn.slice(0, 1500);
  if (typeof result.instruction === "string") base.instruction = result.instruction.slice(0, 800);
  if (typeof result.editUrl === "string") base.editUrl = result.editUrl.slice(0, 300);
  if (Array.isArray(result.saved)) {
    base.saved = result.saved.slice(0, 8);
  } else if (result.saved) {
    base.saved = true;
  }
  if (Array.isArray(result.skipped)) base.skipped = result.skipped.slice(0, 8);
  if (result.confirmed) base.confirmed = true;
  if (result.rejected) base.rejected = true;
  if (Array.isArray(result.notes)) {
    base.notes = result.notes.slice(0, 8);
    if (result.notes.length > 8) base.notes_truncated = true;
  }
  if (result.profile && typeof result.profile === "object") base.profile = result.profile;
  if (Array.isArray(result.matches)) base.matches = result.matches.slice(0, 3);
  if (Array.isArray(result.dm_messages)) base.dm_messages = result.dm_messages.slice(-30);
  if (Array.isArray(result.available)) base.available = result.available.slice(0, 20);
  if (typeof result.error === "string") base.error = result.error.slice(0, 300);
  if (typeof result.answer === "string") base.answer = result.answer.slice(0, 4000);
  if (Array.isArray(result.sources)) base.sources = result.sources.slice(0, 8);
  if (result.route && typeof result.route === "object") base.route = result.route;
  if (result.event && typeof result.event === "object") base.event = result.event;
  if (Array.isArray(result.routes)) base.routes = result.routes.slice(0, 15);
  if (Array.isArray(result.segments)) base.segments = result.segments.slice(0, 15);
  if (Array.isArray(result.candidates)) base.candidates = result.candidates.slice(0, 8);
  if (Array.isArray(result.worlds)) base.worlds = result.worlds.slice(0, 20);

  // Fallback: keep only small scalar keys
  const keepScalars = {};
  for (const [k, v] of Object.entries(result)) {
    if (k in base) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length <= 200) keepScalars[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") keepScalars[k] = v;
  }
  if (Object.keys(keepScalars).length > 0) base.extra = keepScalars;

  return base;
}

module.exports = { compactToolResult };
