/**
 * Who a Zwift ID belongs to, so a member can confirm it before linking.
 *
 * Reads the Zwift profile and the ZwiftPower rider data through the Flask API. Each source ends
 * in one of three states: found, a clean miss (no such rider), or an error (timeout, 5xx). A
 * failed lookup must never look like a missing rider, so:
 *   - either source found the rider            -> { zwift, zp, zpUrl }
 *   - nobody found, and some source errored    -> { error: true }   (caller keeps the plain confirm)
 *   - both sources are clean misses            -> { notFound: true }
 * Only found identities are cached.
 */
const axios = require("axios");
const config = require("../config/config");

const TIMEOUT_MS = 8000;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

function defaultGet(path) {
  const { baseUrl, apiKey } = config.contentApi;
  if (!baseUrl || !apiKey) throw new Error("CONTENT_API_BASE_URL and CONTENT_API_KEY must be set");
  return axios
    .get(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: TIMEOUT_MS })
    .then((res) => res.data);
}

async function source(get, path, parse) {
  try {
    const data = await get(path);
    if (data && typeof data === "object" && typeof data.error === "string") return { state: "error" };
    const value = parse(data);
    return value ? { state: "found", value } : { state: "miss" };
  } catch (error) {
    console.warn(`Rider identity ${path} failed:`, error?.message || error);
    return { state: "error" };
  }
}

function parseZwift(data) {
  if (!data || typeof data !== "object") return null;
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const country = typeof data.countryCode === "string" && /^[a-z]{2,3}$/i.test(data.countryCode)
    ? data.countryCode.toUpperCase()
    : null;
  return {
    name,
    country,
    avatar: typeof data.avatar === "string" ? data.avatar : null,
    racingScore: data.racingScore ?? null,
    category: data.category ?? null,
  };
}

function parseZwiftPower(data) {
  const rows = Array.isArray(data?.data) ? data.data : [];
  if (!rows.length) return null;
  const latest = rows.reduce((a, b) => (Number(b.event_date) > Number(a.event_date) ? b : a));
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const date = Number(latest.event_date) ? new Date(Number(latest.event_date) * 1000).toISOString().slice(0, 10) : null;
  return {
    name: first(latest.name) || null,
    category: latest.category ? String(latest.category) : null,
    team: first(latest.tname) || null,
    lastRace: latest.event_title ? { title: String(first(latest.event_title)), date } : null,
    races: rows.length,
  };
}

async function lookupRiderIdentity(zwiftId, { get = defaultGet, now = Date.now() } = {}) {
  const id = String(zwiftId);
  const hit = cache.get(id);
  if (hit && now - hit.at < CACHE_MS) return hit.value;

  const [zwift, zp] = await Promise.all([
    source(get, `/zwift_profile/${id}`, parseZwift),
    source(get, `/rider_data/${id}`, parseZwiftPower),
  ]);

  if (zwift.state === "found" || zp.state === "found") {
    const value = {
      zwift: zwift.value || null,
      zp: zp.value || null,
      zpUrl: `https://zwiftpower.com/profile.php?z=${id}`,
    };
    cache.set(id, { at: now, value });
    return value;
  }
  if (zwift.state === "error" || zp.state === "error") return { error: true };
  return { notFound: true };
}

function clearCacheForTests() {
  cache.clear();
}

module.exports = { lookupRiderIdentity, clearCacheForTests };
