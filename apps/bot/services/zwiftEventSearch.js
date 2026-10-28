/**
 * Find Zwift events by name, for "the ZRL race yesterday" when nobody has the event link.
 *
 * Zwift's own public API lists only the next few hours, and its full search needs a game login and
 * answers in protobuf. ZwiftPower's event lists cover 3 days back and 7 ahead, each row with the
 * Zwift event id, so the Flask API searches those through the club's ZwiftPower login. The id then
 * goes to zwift_event / route_profile_image for the course and the powerups.
 */
const axios = require("axios");
const config = require("../config/config");

const TIMEOUT_MS = 30000;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

function defaultSearch(q, from, to) {
  const { baseUrl, apiKey } = config.contentApi;
  if (!baseUrl || !apiKey) throw new Error("CONTENT_API_BASE_URL and CONTENT_API_KEY must be set");
  return axios.get(`${baseUrl}/zp_event_search`, {
    params: { q, from, to },
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: TIMEOUT_MS,
  }).then((res) => {
    if (!Array.isArray(res.data?.events)) throw new Error(res.data?.error || "bad response");
    return res.data.events;
  });
}

/**
 * A YYYY-MM-DD day as unix seconds. Danish time is UTC+1 or +2, so the window starts two hours
 * before UTC midnight and ends at UTC midnight: it covers the whole Danish day, plus at most an hour
 * of the evening before, and every row carries its UTC start anyway.
 */
function dayWindow(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return {};
  const midnight = Date.parse(`${date}T00:00:00Z`) / 1000;
  if (!Number.isFinite(midnight)) return {};
  return { from: midnight - 2 * 3600, to: midnight + 24 * 3600 };
}

/** Returns { success, events: [{ zwiftEventId, name, startUtc, distanceKm, laps }] } or { success:false, message }. */
async function findZwiftEvents({ query, date } = {}, deps = {}) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  if (q.length < 3) return { success: false, message: "Give at least 3 letters of the event name." };
  const { from, to } = dayWindow(date);
  const key = `${q.toLowerCase()}|${from || ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  try {
    const events = await (deps.search || defaultSearch)(q, from, to);
    const value = {
      success: true,
      events,
      note: events.length
        ? "Each zwiftEventId works with zwift_event and route_profile_image (event)."
        : "No event matched. ZwiftPower lists events from 3 days back to 7 days ahead; try fewer or other words.",
    };
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.warn("Zwift event search failed:", error?.message || error);
    return { success: false, message: "The event search did not answer. Ask for the Zwift event link instead." };
  }
}

const findZwiftEventsToolDefinition = {
  type: "function",
  function: {
    name: "find_zwift_events",
    description: "Find Zwift events by name when there is no event link, from 3 days back to 7 days ahead, with their Zwift event ids. Use the id with zwift_event or route_profile_image (event) for the course and the powerups.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words from the event name, all must match. Write abbreviations out: ZRL races are named 'Zwift Racing League 26/27: <season> : <League> Division N - Race N', so 'Zwift Racing League Race 5'." },
        date: { type: "string", description: "The day in Danish time, YYYY-MM-DD, e.g. yesterday's date for 'i går'." },
      },
      required: ["query"],
    },
  },
};

module.exports = { findZwiftEvents, findZwiftEventsToolDefinition, dayWindow };
