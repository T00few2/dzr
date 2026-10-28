/**
 * Zwift routes, segments and worlds from the website's zwift-data package.
 *
 * The site is the only install. The bot fetches /api/zwift-catalog, keeps it in memory, and
 * refreshes it so a site deploy with a newer package shows up without a bot restart.
 */
const axios = require("axios");
const config = require("../config/config");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

let catalog = null;
let loadedAt = 0;
let refreshTimer = null;

function acceptCatalog(data) {
  if (!data || !Array.isArray(data.routes) || !Array.isArray(data.segments) || !Array.isArray(data.worlds)) return null;
  return { routes: data.routes, segments: data.segments, worlds: data.worlds };
}

function getZwiftCatalog() {
  return catalog;
}

function setZwiftCatalog(data) {
  const accepted = acceptCatalog(data);
  if (!accepted) throw new Error("Zwift catalog must include routes, segments and worlds.");
  catalog = accepted;
  loadedAt = Date.now();
  return catalog;
}

function clearZwiftCatalog() {
  catalog = null;
  loadedAt = 0;
}

/**
 * Fetch the catalog. A failed refresh keeps the previous copy. Returns the catalog, or null when
 * there has never been one.
 */
async function loadZwiftCatalog({ http = axios, origin = config.intervals.siteOrigin, force = false, now = Date.now() } = {}) {
  if (!force && catalog && now - loadedAt < CACHE_TTL_MS) return catalog;
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) {
    console.warn("Zwift catalog skipped: no site origin");
    return catalog;
  }
  try {
    const response = await http.get(`${base}/api/zwift-catalog`, { timeout: 20000, validateStatus: () => true });
    const accepted = response.status === 200 ? acceptCatalog(response.data) : null;
    if (!accepted) {
      console.warn("Zwift catalog load failed:", response.status);
      return catalog;
    }
    catalog = accepted;
    loadedAt = now;
    return catalog;
  } catch (err) {
    console.warn("Zwift catalog load failed:", err?.message || err);
    return catalog;
  }
}

function scheduleCatalogRefresh(delayMs) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    loadZwiftCatalog({ force: true }).then((data) => {
      scheduleCatalogRefresh(data ? CACHE_TTL_MS : RETRY_MS);
    });
  }, delayMs);
  refreshTimer.unref?.();
}

/** Keep the in-memory catalog current. Retries sooner when the site could not be reached. */
function startZwiftCatalogRefresh() {
  if (refreshTimer) return;
  scheduleCatalogRefresh(catalog ? CACHE_TTL_MS : RETRY_MS);
}

module.exports = {
  CACHE_TTL_MS,
  getZwiftCatalog,
  setZwiftCatalog,
  clearZwiftCatalog,
  loadZwiftCatalog,
  startZwiftCatalogRefresh,
};
