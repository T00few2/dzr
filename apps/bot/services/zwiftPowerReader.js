/**
 * Read-only ZwiftPower access for the helper agent.
 *
 * The ZwiftPower logins stay in apps/api. This module only calls the API's existing GET routes
 * with CONTENT_API_KEY, so the helper can never reach an organizer endpoint or a free-form URL.
 * Results are cached because every call is a scrape on the roster account, and a chatty agent
 * getting that account throttled would also break the scheduled jobs that share it.
 *
 * Everything returned here is compacted: the raw profile and team payloads are large, and the
 * helper only needs a handful of fields per race.
 */
const axios = require("axios");
const config = require("../config/config");

const DZR_ZP_CLUB_ID = Number.parseInt(process.env.ZWIFTPOWER_CLUB_ID || "11939", 10);
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const REQUEST_TIMEOUT_MS = 20000;

const cache = new Map();

function cacheGet(key, now = Date.now()) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, now = Date.now()) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
}

function clearCache() {
  cache.clear();
}

async function apiGet(path, { http = axios } = {}) {
  const cached = cacheGet(path);
  if (cached !== undefined) return cached;
  const response = await http.get(`${config.contentApi.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${config.contentApi.apiKey}` },
    timeout: REQUEST_TIMEOUT_MS,
  });
  cacheSet(path, response.data);
  return response.data;
}

/** ZwiftPower wraps many values as [value, flag]. */
function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function num(value) {
  const n = Number(first(value));
  return Number.isFinite(n) && n !== 0 ? Math.round(n * 100) / 100 : null;
}

function text(value, max = 120) {
  const raw = first(value);
  if (raw === null || raw === undefined) return null;
  const decoded = String(raw)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return decoded ? decoded.slice(0, max) : null;
}

function isoDate(unixSeconds) {
  const n = Number(first(unixSeconds));
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString().slice(0, 16).replace("T", " ") + "Z";
}

function compactRace(row) {
  return {
    event: text(row.event_title),
    date: isoDate(row.event_date),
    category: text(row.category, 8),
    position_in_category: num(row.position_in_cat),
    position_overall: num(row.pos),
    avg_wkg: num(row.avg_wkg),
    avg_watts: num(row.avg_power),
    wkg_20min: num(row.wkg1200),
    wkg_5min: num(row.wkg300),
    wkg_1min: num(row.wkg60),
    weight_kg: num(row.weight),
  };
}

/** A rider's recent races from /rider_data, newest first. */
function compactRiderProfile(payload, { limit = 10 } = {}) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => Number(first(b.event_date) || 0) - Number(first(a.event_date) || 0));
  const latest = sorted[0];
  return {
    name: text(latest.name),
    team: text(latest.tname),
    latest_category: text(latest.category, 8),
    ftp_watts: num(latest.ftp),
    weight_kg: num(latest.weight),
    races_on_record: rows.length,
    recent_races: sorted.slice(0, limit).map(compactRace),
  };
}

/** DZR results from /team_results, grouped by event, newest first. */
function compactTeamResults(payload, { days = 7, title = "", now = Date.now(), maxEvents = 10, maxRiders = 15 } = {}) {
  const events = payload?.events && typeof payload.events === "object" ? payload.events : {};
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const since = now / 1000 - days * 24 * 60 * 60;
  const wanted = String(title || "").trim().toLowerCase();

  const picked = Object.entries(events)
    .map(([zid, info]) => ({ zid: String(zid), title: text(info?.title) || "", date: Number(first(info?.date)) || 0 }))
    .filter((event) => event.date >= since)
    .filter((event) => !wanted || event.title.toLowerCase().includes(wanted))
    .sort((a, b) => b.date - a.date)
    .slice(0, maxEvents);

  const byEvent = new Map(picked.map((event) => [event.zid, []]));
  for (const row of rows) {
    const list = byEvent.get(String(row?.zid));
    if (list) list.push(row);
  }

  return picked.map((event) => {
    const riders = byEvent.get(event.zid) || [];
    riders.sort((a, b) => (num(a.position_in_cat) ?? 999) - (num(b.position_in_cat) ?? 999));
    return {
      event: event.title,
      date: isoDate(event.date),
      dzr_riders: riders.length,
      results: riders.slice(0, maxRiders).map((row) => ({
        name: text(row.name),
        category: text(row.category, 8),
        position_in_category: num(row.position_in_cat),
        avg_wkg: num(row.avg_wkg),
      })),
      results_truncated: riders.length > maxRiders || undefined,
    };
  });
}

async function getRiderRaces(zwiftId, { limit = 10, http } = {}) {
  const id = Number.parseInt(String(zwiftId), 10);
  if (!Number.isFinite(id) || id <= 0) return { success: false, message: "Invalid Zwift ID." };
  const payload = await apiGet(`/rider_data/${id}`, { http });
  const rider = compactRiderProfile(payload, { limit: Math.min(25, Math.max(1, Number(limit) || 10)) });
  if (!rider) return { success: false, message: "ZwiftPower has no race data for that rider." };
  return { success: true, zwift_id: id, rider };
}

async function getClubResults({ days = 7, title = "", http } = {}) {
  const payload = await apiGet(`/team_results/${DZR_ZP_CLUB_ID}`, { http });
  const events = compactTeamResults(payload, {
    days: Math.min(31, Math.max(1, Number(days) || 7)),
    title,
  });
  return {
    success: true,
    events,
    message: events.length ? undefined : "No DZR results in ZwiftPower for that period and filter.",
  };
}

module.exports = {
  DZR_ZP_CLUB_ID,
  getRiderRaces,
  getClubResults,
  compactRiderProfile,
  compactTeamResults,
  clearCache,
};
