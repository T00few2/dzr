/**
 * Signals: what the announcer could post about today, each with the facts the model writes from.
 *
 * Each provider is pure over the data it is handed and returns zero or more candidates:
 *   { key, kind, priority, score, channelId, cooldownDays, reason, facts, meta }
 * key is what cooldowns and open drafts are tracked by; kind is the topic type (one post of a kind
 * is never followed by another of the same kind, except time-bound ones). priority 1 is
 * time-bound, 2 a need among members, 3 a feature spotlight, 4 evergreen filler.
 */
const shared = require("../../constants.json");
const { isCoolingDown, toMs, DAY_MS } = require("./pacing");

const CHANNELS = shared.discord.channels;
const SITE = String(shared.siteOrigin || "").replace(/\/+$/, "");

const COMPANION = {
  pitch: "Meld dig ind i DZR-klubben i Zwift Companion-appen, så ser du klubbens events i Zwift og tæller med i klubbens medlemstal.",
  howTo: "Åbn Zwift Companion → Klubber → søg \"Danish Zwift Racers\" → Tilmeld.",
};

const KIND_LABELS = {
  upcomingClubEvents: "Kommende klub-events",
  newFeatures: "Nyt i botten og på hjemmesiden",
  unlinkedZwiftId: "Link dit Zwift ID",
  notInCompanionClub: "DZR i Zwift Companion",
  dmUnseen: "Tjek dine DMs fra botten",
  featureSpotlight: "Funktion i fokus",
  evergreen: "Tip fra vidensbasen",
};

function upcomingClubEventsSignal({ events, settings, state, now }) {
  const cfg = settings.signals.upcomingClubEvents;
  const until = now.getTime() + cfg.lookaheadDays * DAY_MS;
  const promoted = state?.promotedEvents || {};
  const seen = new Set();
  const picked = [];
  for (const event of [...(events || [])].sort((a, b) => a.startMs - b.startMs)) {
    if (event.startMs <= now.getTime() || event.startMs > until) continue;
    // Weekly series repeat under one name; promote a name at most every nameCooldownDays.
    if (seen.has(event.name) || isCoolingDown(promoted[event.name], cfg.nameCooldownDays, now)) continue;
    seen.add(event.name);
    picked.push(event);
    if (picked.length >= 5) break;
  }
  if (!picked.length) return [];
  return [{
    key: "upcomingClubEvents",
    kind: "upcomingClubEvents",
    priority: 1,
    score: picked.length,
    channelId: settings.channels.events,
    cooldownDays: cfg.cooldownDays,
    reason: `${picked.length} DZR-event(s) de næste ${cfg.lookaheadDays} dage, som ikke er blevet promoveret`,
    facts: {
      events: picked.map((event) => ({ name: event.name, start: event.startLocal, url: event.url })),
    },
    meta: { eventNames: picked.map((event) => event.name) },
  }];
}

function newFeaturesSignal({ commitLog, settings }) {
  const commits = commitLog?.commits || [];
  if (!commits.length) return [];
  return [{
    key: "newFeatures",
    kind: "newFeatures",
    priority: 1,
    score: commits.length,
    channelId: settings.channels.default,
    cooldownDays: settings.signals.newFeatures.cooldownDays,
    reason: `${commits.length} nye ændring(er) på main siden sidste nyhedsopslag`,
    facts: {
      areas: commitLog.areas || [],
      commits: commits.slice(0, 60).map((commit) => ({ subject: commit.subject, details: commit.body })),
    },
    meta: { headSha: commitLog.head },
  }];
}

function unlinkedZwiftIdSignal({ counts, settings }) {
  const cfg = settings.signals.unlinkedZwiftId;
  const unlinked = counts?.unlinkedCount || 0;
  const community = counts?.communityCount || 0;
  const share = community ? unlinked / community : 0;
  if (!unlinked || (unlinked < cfg.minCount && share < cfg.minShare)) return [];
  return [{
    key: "unlinkedZwiftId",
    kind: "unlinkedZwiftId",
    priority: 2,
    score: unlinked,
    channelId: settings.channels.default,
    cooldownDays: cfg.cooldownDays,
    reason: `${unlinked} af ${community} community-medlemmer har ikke linket deres Zwift ID`,
    facts: {
      unlinkedCount: unlinked,
      communityCount: community,
      whyItMatters: "Med linket Zwift ID bliver man ✅ Verificeret Medlem: adgang til members-zone på hjemmesiden, bot-kommandoer som /rider_stats og hjælp til ZRL-kategori.",
      howTo: `Skriv \`zwiftid 1234567\` (sit eget ID) i <#${CHANNELS.zwiftId}>, brug /my_zwiftid, eller send ID'et til botten i en DM. Kender man ikke sit ID, kan man skrive sit navn fra Zwift til botten.`,
      link: `${SITE}/join/zwift-id`,
    },
  }];
}

function notInCompanionClubSignal({ counts, settings }) {
  const cfg = settings.signals.notInCompanionClub;
  const missing = counts?.notInCompanionCount;
  if (missing == null || missing < cfg.minCount) return [];
  return [{
    key: "notInCompanionClub",
    kind: "notInCompanionClub",
    priority: 2,
    score: missing,
    channelId: settings.channels.default,
    cooldownDays: cfg.cooldownDays,
    reason: `${missing} af ${counts.linkedCount} medlemmer med linket Zwift ID er ikke med i DZR-klubben i Zwift Companion`,
    facts: {
      notInClubCount: missing,
      linkedCount: counts.linkedCount,
      pitch: COMPANION.pitch,
      howTo: COMPANION.howTo,
    },
  }];
}

function dmUnseenSignal({ silentCount, settings }) {
  const cfg = settings.signals.dmUnseen;
  if (silentCount == null || silentCount < cfg.minCount) return [];
  return [{
    key: "dmUnseen",
    kind: "dmUnseen",
    priority: 2,
    score: silentCount,
    channelId: settings.channels.default,
    cooldownDays: cfg.cooldownDays,
    reason: `${silentCount} medlemmer har fået en DM fra botten uden at reagere på den (måske ikke set)`,
    facts: {
      silentCount,
      what: "Botten sender personlige beskeder (DM) med næste skridt i onboarding: link Zwift ID, DZR i Companion, DZR Coach.",
      where: "Direkte beskeder: Discord-logoet øverst til venstre på computeren, 💬 nederst på mobilen. Bruger man filtrering, kan beskeden ligge under Beskedanmodninger (Message Requests).",
      tip: "Man kan også skrive til botten selv i DM og stille spørgsmål.",
    },
  }];
}

/**
 * One feature to spotlight, from the catalog the bot reads off its own commands and tools (see
 * featureCatalog.js). Newly shipped features from the commit log go first, once, a month after
 * their news; then the feature spotlighted longest ago, and among equals the one members use least.
 */
function featureSpotlightSignal({ catalog, state, settings, now }) {
  const cfg = settings.signals.featureSpotlight;
  const perSignal = state?.perSignal || {};
  const excluded = new Set(settings.spotlightExcluded || []);
  const shipped = (state?.shippedFeatures || [])
    .filter((feature) => !feature.spotlightedAt && !feature.dismissed && !isCoolingDown(feature.at, cfg.shippedAfterDays, now))
    .map((feature) => ({
      key: `featureSpotlight:shipped:${feature.slug}`,
      shippedSlug: feature.slug,
      facts: { name: feature.title, description: feature.pitch, howToUse: feature.howTo || "" },
    }));
  const fromCatalog = (catalog || [])
    .filter((feature) => !feature.internal && !excluded.has(feature.key))
    .map((feature) => ({
      key: `featureSpotlight:${feature.key}`,
      usage: feature.usedLast30Days,
      facts: { name: feature.name, description: feature.description, howToUse: feature.howToUse, usedLast30Days: feature.usedLast30Days },
    }))
    .sort((a, b) => (toMs(perSignal[a.key]) || 0) - (toMs(perSignal[b.key]) || 0) || (a.usage ?? 0) - (b.usage ?? 0));
  const pick = [...shipped, ...fromCatalog].find((option) => !isCoolingDown(perSignal[option.key], cfg.cooldownDays, now));
  if (!pick) return [];
  const used = pick.usage != null ? ` (brugt ${pick.usage} gange i DMs de sidste 30 dage)` : "";
  return [{
    key: pick.key,
    kind: "featureSpotlight",
    priority: 3,
    score: 0,
    channelId: settings.channels.default,
    cooldownDays: cfg.cooldownDays,
    reason: `Funktion i fokus: ${pick.facts.name}${used}`,
    facts: pick.facts,
    meta: pick.shippedSlug ? { shippedSlug: pick.shippedSlug } : {},
  }];
}

function evergreenSignal({ articles, state, settings, now, random = Math.random }) {
  const cfg = settings.signals.evergreen;
  const perSignal = state?.perSignal || {};
  const eligible = (articles || []).filter((article) =>
    article?.content && !isCoolingDown(perSignal[`evergreen:${article.id}`], cfg.cooldownDays, now));
  if (!eligible.length) return [];
  const article = eligible[Math.floor(random() * eligible.length)];
  return [{
    key: `evergreen:${article.id}`,
    kind: "evergreen",
    priority: 4,
    score: 0,
    channelId: settings.channels.default,
    cooldownDays: cfg.cooldownDays,
    reason: `Tip fra vidensbasen: ${article.title || article.id}`,
    facts: { title: article.title || "", article: String(article.content).slice(0, 1500) },
  }];
}

/**
 * The candidate to draft today, or null.
 * Drops keys on cooldown or with a draft already open, and a repeat of the last published kind
 * (time-bound topics excepted). Then the lowest priority number wins, the larger need breaking ties.
 */
function pickCandidate(candidates, { state, now, openKeys = new Set() }) {
  const perSignal = state?.perSignal || {};
  const eligible = candidates.filter((candidate) =>
    !openKeys.has(candidate.key)
    && !isCoolingDown(perSignal[candidate.key], candidate.cooldownDays, now)
    && (candidate.priority === 1 || candidate.kind !== state?.lastKind));
  eligible.sort((a, b) => a.priority - b.priority || b.score - a.score);
  return eligible[0] || null;
}

/** Count members for the need signals. members: [{ id, bot, roleIds }]. */
function computeMemberCounts(members, linked, companionIds) {
  let communityCount = 0;
  let unlinkedCount = 0;
  let linkedCount = 0;
  let notInCompanionCount = 0;
  for (const member of members) {
    if (member.bot) continue;
    const zwiftId = linked.get(String(member.id));
    if (member.roleIds.includes(shared.discord.roles.communityMember)) {
      communityCount += 1;
      if (!zwiftId) unlinkedCount += 1;
    }
    if (zwiftId) {
      linkedCount += 1;
      if (!companionIds.has(String(zwiftId))) notInCompanionCount += 1;
    }
  }
  // An empty roster means the sync failed, not that nobody is in the club.
  return { communityCount, unlinkedCount, linkedCount, notInCompanionCount: companionIds.size ? notInCompanionCount : null };
}

/**
 * Every signal that has something to say. A failing source is logged and skipped, so one dead
 * feed never silences the rest.
 */
async function gatherCandidates({ deps, settings, state, now }) {
  const on = (name) => settings.signals[name]?.enabled !== false;
  const safely = async (name, fn) => {
    if (!on(name)) return [];
    try {
      return await fn();
    } catch (error) {
      console.warn(`Announcer signal ${name} failed:`, error?.message || error);
      return [];
    }
  };
  const countsNeeded = on("unlinkedZwiftId") || on("notInCompanionClub");
  const counts = countsNeeded ? await deps.memberCounts().catch((error) => {
    console.warn("Announcer member counts failed:", error?.message || error);
    return null;
  }) : null;

  const groups = await Promise.all([
    safely("upcomingClubEvents", async () => upcomingClubEventsSignal({ events: await deps.fetchClubEvents(), settings, state, now })),
    safely("newFeatures", async () => newFeaturesSignal({ commitLog: await deps.commitLog(state, now), settings })),
    safely("unlinkedZwiftId", async () => unlinkedZwiftIdSignal({ counts, settings })),
    safely("notInCompanionClub", async () => notInCompanionClubSignal({ counts, settings })),
    safely("dmUnseen", async () => dmUnseenSignal({ silentCount: await deps.silentDmCount(now, settings.signals.dmUnseen.silentDays), settings })),
    safely("featureSpotlight", async () => featureSpotlightSignal({ catalog: await deps.featureCatalog(), state, settings, now })),
    safely("evergreen", async () => evergreenSignal({ articles: await deps.listKnowledge(), state, settings, now, random: deps.random })),
  ]);
  return groups.flat();
}

module.exports = {
  KIND_LABELS,
  upcomingClubEventsSignal,
  newFeaturesSignal,
  unlinkedZwiftIdSignal,
  notInCompanionClubSignal,
  dmUnseenSignal,
  featureSpotlightSignal,
  evergreenSignal,
  pickCandidate,
  computeMemberCounts,
  gatherCandidates,
};
