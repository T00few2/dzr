// AI analysis of how to ride a ladder match, built on the club bot's OpenAI helper (services/coachLlm.js).
const OpenAI = require("openai");
const { EmbedBuilder } = require("discord.js");
const config = require("../../config/config");
const { COACH_MODEL, COACH_BASE_EFFORT, createStatelessResponse } = require("../coachLlm");
const { describeProfile, loadMatchProfile } = require("./routeInfo");
const { enrichRiders } = require("./riderPower");
const { cleanName } = require("./ladderChart");
const { accentColor } = require("./ladderEmbed");

const MODEL = process.env.LADDER_AI_MODEL || COACH_MODEL;
const EFFORT = process.env.LADDER_AI_REASONING_EFFORT || COACH_BASE_EFFORT;
// Reasoning tokens count towards the limit, so this is well above the ~400 words the answer is asked to stay under.
const MAX_OUTPUT_TOKENS = 4000;
// Runs per Discord user per day; 0 switches the AI analysis off. A cached analysis costs nothing and is not counted.
const DAILY_RUNS = Number.parseInt(process.env.LADDER_AI_DAILY_RUNS || "5", 10);
const CACHE_MS = 30 * 60 * 1000;
const DESCRIPTION_LIMIT = 4000;
const DURATIONS = [
  { seconds: 15, label: "15s" },
  { seconds: 60, label: "1 min" },
  { seconds: 120, label: "2 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 1200, label: "20 min" },
];

const SYSTEM_PROMPT = `Du er en erfaren cykelrace-strategianalytiker for et hold i Zwift Club Ladder. Skriv altid på dansk.

Club Ladder Scoring-regler:
- Der gives point til alle 10 ryttere der fuldender løbet: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 point.
- Hvis en rytter diskvalificeres, rykker rytterne nedenfor én position op.
- Holdets point er summen af holdets rytteres point. Holdet med flest point vinder.
- Ved pointlighed ("uafgjort") taber det udfordrende hold, og det forsvarende hold vinder.

Din analyse skal tage højde for reglerne. Fokuser på at maksimere holdets samlede point, ikke kun individuelle placeringer. Brug kun de tal, du får i prompten, og opfind ikke data. Du kender ikke præcist, hvad de enkelte powerups gør, så nævn dem kun neutralt (fx at holdet skal aftale brugen) og påstå ikke bestemte effekter. Start direkte med analysen uden indledning.`;

const cache = new Map();
const dailyRuns = new Map();

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const fmt = (v) => (typeof v === "number" ? v.toFixed(2) : "-");

function orient(fixture, ourTeam) {
  const awayIsUs = ourTeam && fixture.away.name && fixture.away.name.toLowerCase() === ourTeam.toLowerCase();
  return awayIsUs ? { us: fixture.away, them: fixture.home } : { us: fixture.home, them: fixture.away };
}

function riderTable(team) {
  const header = `Rytter | ZRS | Kat | ${DURATIONS.map((d) => d.label).join(" | ")} | Form (90 dage vs. bedste)`;
  const rows = [...team.riders]
    .sort((a, b) => (b.wkg[1200] || 0) - (a.wkg[1200] || 0))
    .map((r) =>
      [
        cleanName(r.name),
        typeof r.zrs === "number" ? r.zrs : "-",
        r.category || "-",
        ...DURATIONS.map((d) => fmt(r.wkg[d.seconds])),
        typeof r.form === "number" ? `${r.form}%` : "-",
      ].join(" | ")
    );
  return [header, ...rows].join("\n");
}

// Team average and top 3 average per duration, computed here so the model does not have to do the arithmetic.
function teamSummary(team) {
  return DURATIONS.map((d) => {
    const values = team.riders.map((r) => r.wkg[d.seconds]).filter((v) => typeof v === "number").sort((a, b) => b - a);
    if (!values.length) return `${d.label}: ingen data`;
    return `${d.label}: snit ${fmt(mean(values))}, top 3 ${fmt(mean(values.slice(0, 3)))}`;
  }).join("\n");
}

function buildPrompt(fixture, us, them, info = null) {
  const route = fixture.route
    ? `Rute: ${fixture.route}${fixture.world ? ` (${fixture.world})` : ""}${
        info ? `, ${info.distKm.toFixed(1)} km, ${Math.round(info.elevM)} hm (${info.kind.toLowerCase()})` : ""
      }${fixture.laps ? `, ${fixture.laps} omgange` : fixture.distance ? `, fast distance ${(fixture.distance / 1000).toFixed(1)} km` : ""}`
    : "Rute ikke oplyst.";
  const powerups = fixture.powerups && fixture.powerups.length ? `Powerups: ${fixture.powerups.join(", ")}.` : "";

  return `Baseret på nedenstående data, giv en kort og konkret taktisk analyse af denne ladder-kamp. Vi er "${us.name}", modstanderen er "${them.name}".

${route}
${powerups}

Alle power-tal er W/kg (ZwiftPower de seneste 90 dage, ellers ladder). ZRS er Zwift Racing Score.

${us.name} (vores hold, ${us.riders.length} tilmeldte):
${riderTable(us)}
Oversigt:
${teamSummary(us)}

${them.name} (modstander, ${them.riders.length} tilmeldte):
${riderTable(them)}
Oversigt:
${teamSummary(them)}

Giv din analyse i dette format:
1. **Overordnet vurdering** (1-2 sætninger om styrkeforholdet)
2. **Point-strategi** (hvordan vi maksimerer holdets samlede point: samle feltet, sprede modstanderne eller køre individuelt?)
3. **Taktisk anbefaling** (2-4 konkrete punkter om hvornår og hvordan vi skal angribe eller forsvare, baseret på ruten og power-data)
4. **Nøglemodstandere** (hvem skal vi holde øje med og hvorfor)

Vær specifik og handlingsrettet. Referer til konkrete power-tal og rutedetaljer. Hold det kort, maks 400 ord.`;
}

function userError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

let client = null;

async function generateWithOpenAi(prompt) {
  if (!config.openai.apiKey) throw userError("AI-analysen er ikke sat op (OPENAI_API_KEY mangler).");
  client = client || new OpenAI({ apiKey: config.openai.apiKey });
  const response = await createStatelessResponse(client, {
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: prompt }],
    model: MODEL,
    reasoningEffort: EFFORT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    allowTools: false,
    cacheKey: "dzr-ladder-ai",
  });
  return String(response.text || "").trim();
}

function dayKey(userId, now) {
  return `${userId}:${new Date(now).toISOString().slice(0, 10)}`;
}

// Reserves one run for today; false once the user's limit is used up. In memory, so a restart resets it.
function takeRun(userId, now = Date.now(), limit = DAILY_RUNS) {
  if (!(limit > 0)) return false;
  const key = dayKey(userId, now);
  const used = dailyRuns.get(key) || 0;
  if (used >= limit) return false;
  if (dailyRuns.size > 5000) dailyRuns.clear();
  dailyRuns.set(key, used + 1);
  return true;
}

function cachedAnalysis(key, now = Date.now()) {
  const hit = cache.get(key);
  return hit && now - hit.at < CACHE_MS ? hit.text : null;
}

// Distance and climbing from the site's route profile; null when it is unavailable, and the analysis goes on without it.
async function loadRouteInfo(fixture) {
  try {
    return describeProfile(await loadMatchProfile(fixture));
  } catch (err) {
    console.warn("[ladder] Route profile unavailable for the AI analysis:", err.message);
    return null;
  }
}

// AI analysis for a parsed fixture. Cached for 30 minutes per match and team; only fresh runs use up the user's daily limit.
async function buildLadderAiMessage(fixture, ourTeam = null, { userId = "unknown", generate = generateWithOpenAi, enrich = enrichRiders, loadInfo = loadRouteInfo, now = Date.now() } = {}) {
  if (!(DAILY_RUNS > 0)) throw userError("AI-analysen er slået fra.");

  const { us, them } = orient(fixture, ourTeam);
  const key = `${fixture.id}:${us.name}`;
  let text = cachedAnalysis(key, now);

  if (!text) {
    if (!takeRun(userId, now)) throw userError(`Du har brugt dine ${DAILY_RUNS} AI-analyser i dag. Prøv igen i morgen.`);
    await enrich([...us.riders, ...them.riders]);
    text = String((await generate(buildPrompt(fixture, us, them, await loadInfo(fixture)))) || "").trim();
    if (!text) throw userError("AI-analysen gav intet svar. Prøv igen om lidt.");
    cache.set(key, { at: now, text });
  }

  const ts = Math.floor(new Date(fixture.start).getTime() / 1000);
  const embed = new EmbedBuilder()
    .setTitle(`AI-analyse: ${us.name} mod ${them.name}`)
    .setURL(`https://ladder.cycleracing.club/fixture/${fixture.id}`)
    .setDescription(`Starter <t:${ts}:R>\n\n${text.length > DESCRIPTION_LIMIT ? `${text.slice(0, DESCRIPTION_LIMIT)}...` : text}`)
    .setColor(accentColor(fixture, ourTeam))
    .setFooter({ text: "Genereret af AI ud fra ZwiftPower/ladder-data. Vejledende." });
  return { embeds: [embed] };
}

function resetAiState() {
  cache.clear();
  dailyRuns.clear();
}

module.exports = { buildLadderAiMessage, buildPrompt, takeRun, resetAiState, SYSTEM_PROMPT };
