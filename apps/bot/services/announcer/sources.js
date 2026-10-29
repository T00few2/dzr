/**
 * Live data the signals read: guild members, linked Zwift IDs, the Companion roster, DZR's Zwift
 * events, the commit log, the knowledge base and the DM records.
 */
const shared = require("../../constants.json");
const { computeMemberCounts } = require("./signals");
const { fetchCommitLog } = require("./github");
const { isSilent } = require("./dmStats");
const { DAY_MS } = require("./pacing");
const { buildFeatureCatalog, countToolUsage } = require("./featureCatalog");

// Same feed as packages/shared/zwiftEvents.js; the bot deploys on its own and cannot import it.
const DZR_UPCOMING_EVENTS_URL = "https://us-or-rly101.zwift.com/api/public/events/upcoming?limit=200&tags=dzr";
const COMPANION_CACHE_MS = 6 * 60 * 60 * 1000;

let companionCache = { at: 0, ids: null };

/** Zwift IDs in the DZR club in Zwift Companion (doc ids of companion_club_members). Cached. */
async function listCompanionIds(db, nowMs = Date.now()) {
  if (companionCache.ids && nowMs - companionCache.at < COMPANION_CACHE_MS) return companionCache.ids;
  const snap = await db.collection(shared.firestore.companionClubMembers).select().get();
  companionCache = { at: nowMs, ids: new Set(snap.docs.map((doc) => String(doc.id))) };
  return companionCache.ids;
}

async function getGuild(client) {
  return client.guilds.cache.get(shared.discord.guildId) || client.guilds.fetch(shared.discord.guildId);
}

function eventStartLocal(ms, tz) {
  return new Date(ms).toLocaleString("da-DK", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function defaultSources(client, settings) {
  const firebase = require("../firebase");
  const db = firebase.db;
  return {
    async memberCounts() {
      const guild = await getGuild(client);
      const members = await guild.members.fetch();
      const linked = new Map((await firebase.getAllLinkedUsers()).map((user) => [String(user.discordId), user.zwiftId]));
      const companionIds = await listCompanionIds(db);
      const rows = [...members.values()].map((member) => ({ id: member.id, bot: member.user?.bot, roleIds: [...member.roles.cache.keys()] }));
      return computeMemberCounts(rows, linked, companionIds);
    },
    async fetchClubEvents() {
      const response = await fetch(DZR_UPCOMING_EVENTS_URL);
      if (!response.ok) throw new Error(`Zwift events feed ${response.status}`);
      const feed = await response.json();
      return (Array.isArray(feed) ? feed : [])
        .map((raw) => ({ id: raw?.id, name: String(raw?.name || "").trim(), startMs: new Date(raw?.eventStart).getTime() }))
        .filter((event) => event.id && event.name && Number.isFinite(event.startMs))
        .map((event) => ({ ...event, startLocal: eventStartLocal(event.startMs, settings.tz), url: `https://www.zwift.com/events/view/${event.id}` }));
    },
    commitLog(state, now) {
      const sinceIso = new Date(now.getTime() - settings.signals.newFeatures.firstRunDays * DAY_MS).toISOString();
      return fetchCommitLog({ base: state?.github?.lastSha, sinceIso });
    },
    async silentDmCount(now, silentDays) {
      const snap = await db.collection(shared.firestore.onboardingDms).get();
      return snap.docs.filter((doc) => isSilent(doc.data(), now, silentDays)).length;
    },
    listKnowledge: () => firebase.getAllBotKnowledge(),
    featureCatalog: () => readFeatureCatalog(db),
    random: Math.random,
  };
}

/** The spotlight catalog from the bot's own commands and tools, with last-30-day DM tool usage. */
async function readFeatureCatalog(db, now = new Date()) {
  // Required here: the chat handler and commands load late in the bot's startup.
  const { toolDefinitions } = require("../../handlers/aiChatHandler");
  const commands = require("../../commands/slashCommands");
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const snap = await db.collection(shared.firestore.assistantDmEvents).where("at", ">=", since).get();
  return buildFeatureCatalog({ tools: toolDefinitions, commands, usage: countToolUsage(snap.docs.map((doc) => doc.data())) });
}

module.exports = { defaultSources, listCompanionIds, getGuild, readFeatureCatalog };
