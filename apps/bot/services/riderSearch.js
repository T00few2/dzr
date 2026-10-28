/**
 * Find a rider by name, for members who do not know their Zwift ID.
 *
 * Searches DZR's own club stats first, then all of ZwiftPower through the Flask API (the site's
 * Riders tab search, which needs 4+ characters). The member picks themselves from a menu, and the
 * usual confirm card (Zwift profile + ✅) does the linking, so a search never links anything.
 *
 * ZwiftPower searches go through the club's shared ZwiftPower account, so results are cached and
 * each member has a daily allowance. Only public fields come back: name, country, category, team.
 */
const axios = require("axios");
const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const config = require("../config/config");

const TIMEOUT_MS = 20000;
const CACHE_MS = 10 * 60 * 1000;
const ZP_MIN_CHARS = 4;
const CLUB_MIN_CHARS = 3;
const MAX_OPTIONS = 25;
const ZP_SEARCHES_PER_DAY = Number.parseInt(process.env.ZP_RIDER_SEARCHES_PER_DAY || "20", 10);
const SELECT_PREFIX = "myzwift_select:";

const cache = new Map();
const searchesToday = new Map();

function defaultDeps() {
  // Required lazily: firebase initialises on load, which tests must not trigger.
  const { searchRidersByName } = require("./firebase");
  return {
    searchClub: searchRidersByName,
    searchZwiftPower: async (q) => {
      const { baseUrl, apiKey } = config.contentApi;
      if (!baseUrl || !apiKey) throw new Error("CONTENT_API_BASE_URL and CONTENT_API_KEY must be set");
      const res = await axios.get(`${baseUrl}/zp_rider_search`, {
        params: { q },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: TIMEOUT_MS,
      });
      if (!Array.isArray(res.data?.riders)) throw new Error(res.data?.error || "bad response");
      return res.data.riders;
    },
    now: () => new Date(),
  };
}

function fold(text) {
  return String(text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** In memory, so a restart resets it: it protects the shared ZwiftPower account, it is not billing. */
function takeSearch(discordId, now, limit = ZP_SEARCHES_PER_DAY) {
  if (!discordId || !(limit > 0)) return true;
  const key = `${discordId}:${now.toISOString().slice(0, 10)}`;
  const used = searchesToday.get(key) || 0;
  if (used >= limit) return false;
  if (searchesToday.size > 5000) searchesToday.clear();
  searchesToday.set(key, used + 1);
  return true;
}

async function zwiftPowerRiders(term, discordId, deps) {
  const key = fold(term);
  const hit = cache.get(key);
  const now = deps.now();
  if (hit && now - hit.at < CACHE_MS) return { riders: hit.riders };
  if (!takeSearch(discordId, now)) return { riders: [], limited: true };
  try {
    const riders = await deps.searchZwiftPower(term);
    cache.set(key, { at: now, riders });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return { riders };
  } catch (error) {
    console.warn("ZwiftPower rider search failed:", error?.message || error);
    return { riders: [], error: true };
  }
}

/**
 * Riders matching a name: DZR club riders first, then ZwiftPower riders not already listed.
 * Returns { riders: [{ zwiftId, name, country, category, team, inClub }], zpError, zpLimited, tooShort }.
 */
async function findRidersByName(term, { discordId } = {}, deps = defaultDeps()) {
  const q = String(term || "").replace(/\s+/g, " ").trim();
  if (q.length < CLUB_MIN_CHARS) return { riders: [], tooShort: true };

  const clubRows = await deps.searchClub(q).catch((error) => {
    console.warn("Club rider search failed:", error?.message || error);
    return [];
  });
  const riders = clubRows.map((r) => ({
    zwiftId: Number(r.riderId),
    name: r.name,
    country: r.country || null,
    category: r.zpCategory || null,
    team: "DZR",
    inClub: true,
  }));

  let zp = { riders: [] };
  if (q.length >= ZP_MIN_CHARS) zp = await zwiftPowerRiders(q, discordId, deps);
  const seen = new Set(riders.map((r) => r.zwiftId));
  for (const r of zp.riders) {
    if (seen.has(r.zwiftId)) continue;
    seen.add(r.zwiftId);
    riders.push({ ...r, inClub: false });
  }
  return { riders: riders.slice(0, MAX_OPTIONS), zpError: !!zp.error, zpLimited: !!zp.limited, tooShort: false };
}

const FLAG_BASE = 0x1f1e6;
function flag(country) {
  if (!/^[A-Z]{2}$/.test(country || "")) return "";
  return String.fromCodePoint(FLAG_BASE + country.charCodeAt(0) - 65, FLAG_BASE + country.charCodeAt(1) - 65);
}

function optionDescription(rider) {
  return [
    `ZwiftID ${rider.zwiftId}`,
    rider.country,
    rider.category ? `kat. ${rider.category}` : null,
    rider.team ? `hold: ${rider.team}` : null,
  ].filter(Boolean).join(" · ").slice(0, 100);
}

/**
 * The reply for a search: a menu bound to the member who searched (others cannot pick from it),
 * or tips when nothing was found.
 */
function buildRiderSearchReply(userId, term, result) {
  if (result.tooShort) return { content: `Skriv mindst ${CLUB_MIN_CHARS} bogstaver af dit navn, som det står på Zwift.` };
  if (!result.riders.length) {
    const lines = [`Jeg fandt ingen ryttere, der hedder "${term}".`];
    if (result.zpError) lines.push("ZwiftPower svarede ikke lige nu, så jeg har kun søgt i DZR's egne ryttere. Prøv igen om lidt.");
    else if (result.zpLimited) lines.push("Du har brugt dagens søgninger på ZwiftPower. Prøv igen i morgen, eller send mig dit Zwift ID.");
    else if (term.length < ZP_MIN_CHARS) lines.push(`Skriv mindst ${ZP_MIN_CHARS} bogstaver, så søger jeg også på hele ZwiftPower.`);
    else lines.push("Prøv dit fulde navn, som det står på Zwift. Jeg søger på ZwiftPower, så du skal have logget ind på zwiftpower.com med din Zwift-konto mindst én gang.");
    return { content: lines.join("\n") };
  }
  const options = result.riders.map((r) => ({
    label: `${flag(r.country)} ${r.name}`.trim().slice(0, 100) || String(r.zwiftId),
    description: optionDescription(r),
    value: String(r.zwiftId),
  }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${SELECT_PREFIX}${userId}`)
      .setPlaceholder("Vælg dig selv…")
      .addOptions(options),
  );
  const note = result.zpError ? "\n(ZwiftPower svarede ikke, så listen har kun DZR's egne ryttere.)" : "";
  return {
    content: `Jeg fandt ${result.riders.length} ryttere for "${term}". Vælg dig selv, så viser jeg din profil til bekræftelse:${note}`,
    components: [row],
  };
}

/** The member a search menu belongs to; null for the old unbound menu id. */
function riderSelectOwner(customId) {
  return customId.startsWith(SELECT_PREFIX) ? customId.slice(SELECT_PREFIX.length) : null;
}

function isRiderSelect(customId) {
  return customId === "myzwift_select" || customId.startsWith(SELECT_PREFIX);
}

function resetRiderSearch() {
  cache.clear();
  searchesToday.clear();
}

module.exports = {
  findRidersByName,
  buildRiderSearchReply,
  riderSelectOwner,
  isRiderSelect,
  resetRiderSearch,
  ZP_MIN_CHARS,
};
