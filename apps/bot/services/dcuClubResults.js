/**
 * DZR's results in DCU E-serien.
 *
 * One race's results come from the public races list behind dansk-ecykling.dk: each finished race
 * carries `results`, keyed by division, with every rider's club, finishRank, time and points.
 * We keep only Danish Zwift Racers, with their place in the full division.
 * The season table and the club ranking come from the club API, which needs the club login.
 */
const axios = require("axios");
const { RACES_URL } = require("./dcuESerien");

const CLUB_API_BASE = "https://us-central1-dcu-member-liga-479507.cloudfunctions.net/dcu_api";
const CACHE_TTL_MS = 2 * 60 * 1000;
const CLUB_NAME = "Danish Zwift Racers";
const cache = new Map();

const STOP_WORDS = new Set(["dcu", "e-serien", "eserien", "serien", "resultat", "resultater", "stilling", "stillingen"]);

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

function wordsOf(query) {
  return fold(query).split(/\s+/).filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function formatFinish(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  const total = Math.floor(n / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function divisionMatches(category, filter) {
  const wanted = fold(filter);
  if (!wanted) return true;
  const name = fold(category);
  if (name.includes(wanted)) return true;
  const number = wanted.match(/\d+/)?.[0];
  if (!number) return false;
  return name === number || name.startsWith(`${number}.`) || name.startsWith(`${number} `);
}

function nameMatches(name, filter) {
  const words = wordsOf(filter).length ? wordsOf(filter) : fold(filter).split(/\s+/).filter((word) => word.length >= 2);
  if (!words.length) return true;
  const folded = fold(name);
  return words.every((word) => folded.includes(word));
}

function compactRider(rider) {
  const row = {
    position: Number(rider.position ?? rider.finishRank) > 0 ? Number(rider.position ?? rider.finishRank) : null,
    name: rider.name || null,
    time: formatFinish(rider.finishTime),
    points: Number(rider.totalPoints) || 0,
    finish_points: Number(rider.finishPoints) || 0,
    sprint_points: Number(rider.sprintPoints) || 0,
    status: rider.raceStatus || null,
  };
  if (rider.disqualified) row.disqualified = true;
  if (rider.declassified) row.declassified = true;
  if (rider.transferFromCategory) row.moved_from = rider.transferFromCategory;
  return row;
}

function compactRaceMeta(race) {
  return {
    id: race.id,
    name: race.name || null,
    date: race.date || null,
    results_phase: race.resultsPhase || null,
    stage: race.stageRaceName || undefined,
  };
}

function credentials(options) {
  const username = String(options.username ?? process.env.DCU_E_SERIE_USERNAME ?? "").trim();
  const secret = String(options.secret ?? process.env.DCU_E_SERIE_SECRET ?? "").trim();
  return { username, secret };
}

async function clubGet(path, { http, now, username, secret }) {
  return cachedGet(`${CLUB_API_BASE}${path}`, { http, now, username, secret });
}

async function cachedGet(url, { http, now, username = "", secret = "" }) {
  const key = `${username}\n${url}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.data;
  const headers = username
    ? { Authorization: `Basic ${Buffer.from(`${username}:${secret}`, "utf8").toString("base64")}` }
    : {};
  const response = await http.get(url, { timeout: 20000, headers, validateStatus: () => true });
  const status = Number(response?.status);
  if (status === 429) {
    const error = new Error("rate");
    error.publicMessage = "DCU E-serien results are busy. Try again in a minute.";
    throw error;
  }
  if (status === 401 || status === 403) {
    const error = new Error("auth");
    error.publicMessage = "DCU E-serien results login was rejected.";
    throw error;
  }
  if (status !== 200 || response?.data == null) {
    const error = new Error(`status ${status}`);
    error.publicMessage = "Could not load DCU E-serien results right now.";
    throw error;
  }
  cache.set(key, { at: now, data: response.data });
  return response.data;
}

function pickRace(matched, { named, now }) {
  if (!named || matched.length === 1) return named ? matched[0] : matched[matched.length - 1];
  const today = new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
  const todayHits = matched.filter((race) => String(race.date || "").slice(0, 10) === today);
  return todayHits.length === 1 ? todayHits[0] : null;
}

function matchRaces(races, { query, date }) {
  const words = wordsOf(query);
  let list = (Array.isArray(races) ? races : []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (date) list = list.filter((race) => String(race.date || "").startsWith(String(date)));
  if (words.length) {
    list = list.filter((race) => words.every((word) => fold(`${race.name} ${race.stageRaceName}`).includes(word)));
  }
  return list;
}

function hasResults(race) {
  const results = race?.results;
  return Boolean(results && typeof results === "object" && Object.values(results).some((list) => Array.isArray(list) && list.length));
}

function isClubRider(person) {
  return fold(person?.club) === fold(CLUB_NAME);
}

// `results` is { "1. Division": [every rider in that division] }.
function applyRiderFilters(results, { rider, division }) {
  return Object.entries(results && typeof results === "object" ? results : {})
    .filter(([category]) => divisionMatches(category, division))
    .map(([category, list]) => ({
      division: category || null,
      field_size: Array.isArray(list) ? list.length : 0,
      riders: (Array.isArray(list) ? list : [])
        .filter((person) => isClubRider(person) && nameMatches(person.name, rider))
        .map(compactRider)
        .sort((a, b) => (a.position || Infinity) - (b.position || Infinity)),
    }))
    .filter((row) => row.riders.length > 0);
}

const RESULTS_NOTE = "Only Danish Zwift Racers riders are listed. position is the place in the full division (field_size), in the official result order, not a ranking among DZR riders and not sorted by time. results_phase provisional means the result can still change.";

async function loadRace(args, options) {
  const index = await cachedGet(RACES_URL, { http: options.http, now: options.now });
  const races = (Array.isArray(index?.races) ? index.races : []).filter(hasResults);
  const query = String(args.query || "").trim();
  const date = String(args.date || "").trim();
  const matched = matchRaces(races, { query, date });
  const named = wordsOf(query).length > 0 || Boolean(date);
  if (!matched.length) {
    return {
      success: true,
      message: "No DCU E-serien race with results matched.",
      races: races.slice(-8).map(compactRaceMeta),
    };
  }
  const race = pickRace(matched, { named, now: options.now });
  if (!race) {
    return {
      success: true,
      message: "Several races matched. Ask which one.",
      races: matched.slice(-8).map(compactRaceMeta),
    };
  }
  const divisions = applyRiderFilters(race.results, args);
  const filtered = Boolean(String(args.rider || "").trim() || String(args.division || "").trim());
  if (!divisions.length) {
    return {
      success: true,
      ...compactRaceMeta(race),
      message: filtered ? "No DZR rider matched that name or division in this race." : "No DZR riders in this result.",
      divisions: [],
      note: RESULTS_NOTE,
    };
  }
  return {
    success: true,
    ...compactRaceMeta(race),
    divisions,
    note: RESULTS_NOTE,
  };
}

async function loadStandings(args, options) {
  const body = await clubGet("/club-api/standings", options);
  const divisions = (Array.isArray(body?.divisions) ? body.divisions : [])
    .filter((row) => divisionMatches(row.category, args.division))
    .map((row) => ({
      division: row.category || null,
      riders: (Array.isArray(row.riders) ? row.riders : [])
        .filter((person) => nameMatches(person.name, args.rider))
        .map((person) => ({
          position: person.position,
          name: person.name || null,
          points: Number(person.totalPoints) || 0,
          races: Number(person.raceCount) || 0,
          counting: (Array.isArray(person.results) ? person.results : [])
            .filter((line) => line.counting)
            .map((line) => ({
              race: line.raceName || null,
              date: line.date || null,
              points: Number(line.points) || 0,
            })),
        }))
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
    }))
    .filter((row) => row.riders.length > 0);
  if (!divisions.length) {
    return { success: true, message: "No DZR rider matched in the DCU E-serien standings.", divisions: [] };
  }
  return {
    success: true,
    kind: "standings",
    divisions,
    note: "Season standings for Danish Zwift Racers only. position is the place in the full division. counting lists the results that make up points.",
  };
}

async function loadClubs(options) {
  const body = await clubGet("/club-api/club-standings", options);
  const clubs = (Array.isArray(body?.clubs) ? body.clubs : []).map((row) => ({
    rank: row.rank,
    club: row.club || null,
    points: Number(row.points) || 0,
    yours: row.yours === true || undefined,
    riders: (Array.isArray(row.riders) ? row.riders : []).map((person) => ({
      name: person.name || null,
      points: Number(person.points) || 0,
    })),
  }));
  return {
    success: true,
    kind: "clubs",
    clubs,
    note: "Club classification. A club's points are its three riders with the most season points. yours marks Danish Zwift Racers.",
  };
}

/**
 * DZR results in DCU E-serien.
 * kind: race (default, public data), standings or clubs (club API login).
 */
async function getDcuResults(args = {}, options = {}) {
  const login = credentials(options);
  const kind = args.kind === "standings" || args.kind === "clubs" ? args.kind : "race";
  if (kind !== "race" && (!login.username || !login.secret)) {
    return { success: false, message: "DCU E-serien standings are not configured." };
  }
  const call = { ...options, ...login, http: options.http || axios, now: options.now || Date.now() };
  try {
    if (kind === "standings") return await loadStandings(args, call);
    if (kind === "clubs") return await loadClubs(call);
    return await loadRace(args, call);
  } catch (err) {
    console.warn("DCU E-serien results failed:", err?.publicMessage || err?.message || err);
    return { success: false, message: err?.publicMessage || "Could not load DCU E-serien results right now." };
  }
}

function resetCache() {
  cache.clear();
}

const dcuResultsToolDefinition = {
  type: "function",
  function: {
    name: "dcu_eserien_results",
    description: "Danish Zwift Racers' results in DCU E-serien: how a race went, who placed, points, the season table, or the club ranking. Only DZR riders, with their place in the full division. With no race name or date, the latest race that has results. Not ZwiftPower and not the race calendar.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["race", "standings", "clubs"],
          description: "race (default): one race. standings: season table. clubs: club classification.",
        },
        query: { type: "string", description: "Words from the race name, e.g. 'DZR løbet'. Ignored for standings and clubs." },
        date: { type: "string", description: "Race date, YYYY-MM-DD. Ignored for standings and clubs." },
        rider: { type: "string", description: "Optional rider name, to return only that rider." },
        division: { type: "string", description: "Optional division, e.g. '2' or '2. Division'." },
      },
    },
  },
};

module.exports = {
  getDcuResults,
  dcuResultsToolDefinition,
  resetCache,
  formatFinish,
  CLUB_API_BASE,
};
