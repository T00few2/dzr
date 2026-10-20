// Per-rider power from ZwiftPower (peak W/kg) and ZRS/category from Zwift, fetched through the Flask API and cached in Firestore.
const axios = require("axios");
const config = require("../../config/config");
const { createStore } = require("./ladderStore");

const TTL_MS = 6 * 60 * 60 * 1000;
const RECENT_DAYS = 90;
const CONCURRENCY = 4;
const DURATIONS = [5, 15, 30, 60, 120, 300, 1200];

const store = createStore("riderPower", () => ({}));

async function apiGet(path) {
  const { baseUrl, apiKey } = config.contentApi;
  if (!baseUrl || !apiKey) throw new Error("CONTENT_API_BASE_URL and CONTENT_API_KEY must be set");
  const res = await axios.get(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60000 });
  return res.data;
}

// Expired entries are dropped on save, which keeps the stored document small.
function saveCache() {
  const cache = store.get();
  for (const id of Object.keys(cache)) if (Date.now() - cache[id].fetchedAt >= TTL_MS) delete cache[id];
  store.persist();
}

// recent = best W/kg in the last 90 days, best = best W/kg ever, both from ZwiftPower race results.
function summarizeProfile(json, nowSeconds = Math.floor(Date.now() / 1000)) {
  const since = nowSeconds - RECENT_DAYS * 86400;
  const recent = {};
  const best = {};
  let latest = null;
  for (const row of json.data || []) {
    if (!latest || row.event_date > latest.event_date) latest = row;
    const weight = parseFloat(row.weight && row.weight[0]);
    if (!(weight > 0)) continue;
    for (const sec of DURATIONS) {
      const watts = parseFloat(row[`w${sec}`] && row[`w${sec}`][0]);
      if (!(watts > 0)) continue;
      const wkg = watts / weight;
      if (!(wkg <= best[sec])) best[sec] = wkg;
      if (row.event_date >= since && !(wkg <= recent[sec])) recent[sec] = wkg;
    }
  }
  return { recent, best, category: latest && latest.category ? String(latest.category) : null };
}

// Form = how close the last 90 days are to the rider's all-time best (mean of 5 min and 20 min), in percent.
function formPercent(zp) {
  const ratios = [300, 1200].filter((s) => zp.recent[s] && zp.best[s]).map((s) => zp.recent[s] / zp.best[s]);
  return ratios.length ? Math.round((100 * ratios.reduce((a, b) => a + b, 0)) / ratios.length) : null;
}

async function fetchZwiftPower(zwid) {
  const json = await apiGet(`/rider_data/${zwid}`);
  // The API answers {} when ZwiftPower has no profile for the rider.
  return Array.isArray(json && json.data) && json.data.length ? summarizeProfile(json) : null;
}

async function fetchZrs(zwid) {
  const profile = await apiGet(`/zwift_profile/${zwid}`);
  if (!profile || profile.racingScore == null) return null;
  return { score: profile.racingScore, category: profile.category || null };
}

async function fetchRider(zwid) {
  const [zp, zrs] = await Promise.all([
    fetchZwiftPower(zwid).catch((err) => {
      console.warn(`[ladder riderPower] ZwiftPower ${zwid}:`, err.message);
      return null;
    }),
    fetchZrs(zwid).catch((err) => {
      console.warn(`[ladder riderPower] ZRS ${zwid}:`, err.message.slice(0, 120));
      return null;
    }),
  ]);
  if (!zp && !zrs) return null;
  return { fetchedAt: Date.now(), zp, zrs };
}

// Returns Map(zwid -> { zp: {recent, best, category} | null, zrs: {score, category} | null }); riders that fail are left out.
async function getRiderPower(zwids) {
  const cache = await store.load();
  const result = new Map();
  const todo = [];
  for (const id of new Set(zwids.map(String))) {
    const hit = cache[id];
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) result.set(id, hit);
    else todo.push(id);
  }
  if (!todo.length) return result;

  const queue = [...todo];
  const load = async (id) => {
    const data = await fetchRider(id);
    if (!data) return;
    cache[id] = data;
    result.set(id, data);
  };
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) await load(id);
  };
  // The first rider goes alone so a cold API logs in to Zwift once instead of once per parallel worker.
  await load(queue.shift());
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  saveCache();
  return result;
}

// Fills riders (each with a zwiftId and a wkg map) from ZwiftPower first and keeps the ladder's own values where ZwiftPower has none.
async function enrichRiders(riders) {
  const ids = riders.map((r) => r.zwiftId).filter(Boolean);
  if (!ids.length) return;
  let data;
  try {
    data = await getRiderPower(ids);
  } catch (err) {
    console.warn("[ladder riderPower] Enrichment failed, keeping ladder data:", err.message);
    return;
  }
  for (const rider of riders) {
    const d = data.get(String(rider.zwiftId));
    if (!d) continue;
    if (d.zp) {
      for (const sec of DURATIONS) if (d.zp.recent[sec]) rider.wkg[sec] = d.zp.recent[sec];
      rider.form = formPercent(d.zp);
      rider.zpCategory = d.zp.category;
    }
    if (d.zrs) {
      rider.zrs = d.zrs.score;
      rider.category = d.zrs.category;
    }
  }
}

module.exports = { getRiderPower, enrichRiders, summarizeProfile, formPercent };
