/**
 * Route profiles from the DZR site's public /api/route-profile, the same data the series pages
 * draw. Using the site keeps one source of truth for elevation streams, lead-ins, laps and where
 * climbs and sprints sit; the bot only draws.
 */
const axios = require("axios");
const config = require("../config/config");

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const cache = new Map();

function profileUrl({ world = "", route, laps, climbs } = {}, origin = config.intervals.siteOrigin) {
  const params = new URLSearchParams({ world: String(world || ""), route: String(route || "") });
  const lapCount = Number.parseInt(laps, 10);
  if (lapCount > 1) params.set("laps", String(Math.min(lapCount, 20)));
  const names = (Array.isArray(climbs) ? climbs : []).map((c) => String(c).trim()).filter(Boolean).slice(0, 3);
  if (names.length) params.set("climbs", names.join(","));
  return `${String(origin).replace(/\/$/, "")}/api/route-profile?${params}`;
}

/** Returns { success, profile } or { success:false, message }. Never throws. */
async function getRouteProfile(request, { http = axios } = {}) {
  const url = profileUrl(request);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const response = await http.get(url, { timeout: 20000, validateStatus: () => true });
    let value;
    if (response.status === 200 && Array.isArray(response.data?.distanceKm)) {
      value = { success: true, profile: response.data };
    } else if (response.status === 404) {
      value = { success: false, message: "The site has no elevation profile for that route." };
    } else {
      return { success: false, message: "Could not load the route profile right now." };
    }
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn("getRouteProfile failed:", err?.message || err);
    return { success: false, message: "Could not load the route profile right now." };
  }
}

module.exports = { getRouteProfile, profileUrl };
