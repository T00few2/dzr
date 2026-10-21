/**
 * DCU E-serien race calendar, from the API behind dansk-ecykling.dk/schedule.
 *
 * The calendar page is drawn by JavaScript, so neither a web search nor read_web_page can see it.
 * It loads this public, unauthenticated, read-only list, which holds each race's route, laps,
 * distance, division groups, Zwift event ids and the segments that score points.
 */
const axios = require("axios");
const zwiftData = require("zwift-data");

const RACES_URL = "https://us-central1-dcu-member-liga-479507.cloudfunctions.net/dcu_api/races";
const SCHEDULE_PAGE = "https://www.dansk-ecykling.dk/schedule";
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null;

const routeById = new Map(zwiftData.routes.filter((r) => r.id).map((r) => [String(r.id), r]));
const worldBySlug = new Map(zwiftData.worlds.map((w) => [w.slug, w.name]));

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .trim();
}

function worldName(map, route) {
  if (route) return worldBySlug.get(route.world) || route.world;
  const slug = String(map || "").toLowerCase().replace(/_/g, "-");
  return worldBySlug.get(slug) || (map ? String(map).charAt(0) + String(map).slice(1).toLowerCase() : null);
}

function pointSegments(list) {
  return (Array.isArray(list) ? list : []).map((s) => (s.lap > 1 ? `${s.name} (lap ${s.lap})` : s.name));
}

function compactRace(race) {
  const route = routeById.get(String(race.routeId || ""));
  const groups = (race.raceGroups || []).map((group) => ({
    name: group.name || null,
    divisions: (group.categories || []).map((c) => c.category),
    laps: group.laps || undefined,
    zwift_event_id: group.eventId || undefined,
    point_segments: pointSegments(group.sprints),
  }));
  const sameSegments = groups.length > 1 && groups.every((g) => g.point_segments.join("|") === groups[0].point_segments.join("|"));
  return {
    date: race.date || null,
    name: race.name || null,
    route: race.routeName || route?.name || null,
    world: worldName(race.map, route),
    laps: Number(race.laps) || 1,
    distance_km: Number(race.totalDistance) > 0 ? Number(race.totalDistance) : null,
    elevation_m: Number(race.totalElevation) > 0 ? Math.round(Number(race.totalElevation)) : null,
    scoring: race.type || null,
    point_segments: sameSegments ? groups[0].point_segments : pointSegments(race.sprints),
    groups: groups.map((g) => (sameSegments ? { ...g, point_segments: undefined } : g)),
    zwift_event_ids: race.linkedEventIds?.length ? race.linkedEventIds : (race.eventId ? [race.eventId] : []),
    results_final: Boolean(race.finalizedAt) || undefined,
  };
}

async function loadRaces({ http = axios, now = Date.now() } = {}) {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.races;
  const response = await http.get(RACES_URL, { timeout: 20000 });
  const races = Array.isArray(response.data?.races) ? response.data.races : [];
  cache = { at: now, races };
  return races;
}

/**
 * Races matching a name or date, or the next ones when neither is given.
 * `date` is YYYY-MM-DD in Danish time, matching the calendar's own dates.
 */
async function getDcuRaces({ query = "", date = "", include_past = false, limit = 5 } = {}, { http, now = Date.now() } = {}) {
  let races;
  try {
    races = await loadRaces({ http, now });
  } catch (err) {
    console.warn("DCU E-serien races failed:", err?.message || err);
    return { success: false, message: "Could not load the DCU E-serien calendar right now.", calendar: SCHEDULE_PAGE };
  }
  const today = new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
  const words = fold(query).split(/\s+/).filter((w) => w.length >= 2 && !["dcu", "e-serien", "eserien", "serien", "lobet", "lob"].includes(w));
  let list = [...races].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (date) list = list.filter((r) => String(r.date || "").startsWith(String(date)));
  else if (!include_past) list = list.filter((r) => String(r.date || "").slice(0, 10) >= today);
  if (words.length) list = list.filter((r) => words.every((w) => fold(`${r.name} ${r.routeName} ${r.map}`).includes(w)));
  const n = Math.min(12, Math.max(1, Number(limit) || 5));
  return {
    success: true,
    today,
    races: list.slice(0, n).map(compactRace),
    calendar: SCHEDULE_PAGE,
    message: list.length ? undefined : "No DCU E-serien race matched.",
  };
}

function resetCache() {
  cache = null;
}

const dcuRacesToolDefinition = {
  type: "function",
  function: {
    name: "dcu_eserien_races",
    description: "DCU E-serien's own race calendar (dansk-ecykling.dk): date and time (Danish), race name such as 'DZR løbet', route, world, laps, distance, elevation, the segments that score points, division groups and Zwift event ids. With no filter it lists the next races.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words from the race name or route, e.g. 'DZR' or 'Itza Party'." },
        date: { type: "string", description: "A date, YYYY-MM-DD." },
        include_past: { type: "boolean", description: "Also search finished races. Default false." },
        limit: { type: "number", description: "1-12. Default 5." },
      },
    },
  },
};

module.exports = { getDcuRaces, compactRace, dcuRacesToolDefinition, resetCache, RACES_URL };
