/**
 * One Zwift event's course from Zwift's public events API.
 *
 * zwift.com/events/view/<id> is drawn by JavaScript, so a web search or a page read sees no route,
 * laps or distance. The public API returns them as data. Route ids are matched to names with
 * the website route catalog, the same one the route tools use.
 */
const axios = require("axios");
const { getZwiftCatalog, loadZwiftCatalog } = require("./zwiftCatalog");
const { parseArchPowerups, parsePowerupPercent, parseStartingPowerup } = require("./powerupPlaces");
const { powerupName } = require("./powerupIcons");

const API = "https://us-or-rly101.zwift.com/api/public/events";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function routeById(routeId) {
  const id = Number(routeId);
  if (!Number.isFinite(id)) return null;
  return (getZwiftCatalog()?.routes || []).find((route) => Number(route.id) === id) || null;
}

function worldName(slug) {
  return (getZwiftCatalog()?.worlds || []).find((world) => world.slug === slug)?.name || slug;
}

/** An event id from a number, "123", or any zwift.com/events/view/<id> style link. */
function parseEventId(value) {
  const text = String(value ?? "").trim();
  const fromUrl = text.match(/events\/(?:[^/?#]+\/)*view\/(\d+)/i) || text.match(/[?&]eventId=(\d+)/i);
  const raw = fromUrl ? fromUrl[1] : text;
  return /^\d{4,12}$/.test(raw) ? Number(raw) : null;
}

function courseOf(row) {
  const route = routeById(row?.routeId);
  const distanceKm = Number(row?.distanceInMeters) > 0 ? Math.round(row.distanceInMeters / 100) / 10 : null;
  return {
    route: route?.name || null,
    world: route ? worldName(route.world) : null,
    route_id: row?.routeId ?? null,
    laps: distanceKm ? null : Number(row?.laps) || 1,
    distance_km: distanceKm,
  };
}

/**
 * The powerup setup from the event tags, the same tags the ladder page copies. Categories carry the
 * same tags as the event, so the first tagged category is the fallback when the event has none.
 */
function powerupsOf(event) {
  const tagged = [event.tags, ...(event.eventSubgroups || []).map((group) => group.tags)]
    .find((tags) => Array.isArray(tags) && tags.some((tag) => /powerup/.test(String(tag))));
  const ids = parsePowerupPercent(tagged || []);
  const arch = parseArchPowerups(tagged || []);
  const start = parseStartingPowerup(tagged || []);
  const name = (id) => powerupName(id) || String(id);
  if (!ids.length && !Object.keys(arch).length && start == null) return {};
  const fixed = [...new Set(Object.values(arch))];
  return {
    powerups: ids.map(name),
    powerup_ids: ids,
    // ZRL sets no random bag, only a fixed powerup per arch: those names, for the answer and caption.
    banner_powerups: fixed.length ? fixed.map(name) : undefined,
    arch_powerups: Object.keys(arch).length ? arch : undefined,
    start_powerup: start != null ? name(start) : undefined,
  };
}

/**
 * The event's course, start and categories. Categories are listed only when one differs from the
 * main course, which is how races give shorter distances to lower categories.
 */
function compactEvent(event) {
  const main = courseOf(event);
  const key = (course) => `${course.route_id}|${course.laps}|${course.distance_km}`;
  const groups = (event.eventSubgroups || []).map((group) => ({
    category: group.subgroupLabel || group.name || null,
    start: group.eventSubgroupStart || null,
    ...courseOf(group),
  }));
  const differing = groups.filter((group) => key(group) !== key(main));
  return {
    id: event.id,
    name: String(event.name || "").trim(),
    start_utc: event.eventStart || null,
    type: event.eventType || null,
    ...main,
    route_known: Boolean(main.route),
    categories_with_other_course: differing.length ? differing : undefined,
    ...powerupsOf(event),
    description: String(event.description || "").replace(/\s+/g, " ").trim().slice(0, 600) || undefined,
  };
}

async function getZwiftEvent(idOrUrl, { http = axios } = {}) {
  const id = parseEventId(idOrUrl);
  if (!id) return { success: false, message: "Give a Zwift event id or a zwift.com/events/view/<id> link." };
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  await loadZwiftCatalog();
  try {
    const response = await http.get(`${API}/${id}`, { timeout: 15000, validateStatus: () => true });
    if (response.status === 404) return { success: false, message: `Zwift has no event ${id}.` };
    if (response.status !== 200 || !response.data?.id) return { success: false, message: "Zwift's event API did not answer." };
    const value = { success: true, event: compactEvent(response.data) };
    const unnamedBecauseCatalogIsDown = value.event.route_id != null && !value.event.route && !getZwiftCatalog();
    if (!unnamedBecauseCatalogIsDown) {
      if (cache.size > 200) cache.clear();
      cache.set(id, { at: Date.now(), value });
    }
    return value;
  } catch (err) {
    console.warn("getZwiftEvent failed:", err?.message || err);
    return { success: false, message: "Zwift's event API did not answer." };
  }
}

module.exports = { getZwiftEvent, parseEventId, compactEvent };
