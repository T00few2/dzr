// Source of truth; copied to apps/bot by npm run sync:shared.
//
// The existing features the announcer spotlights. These are the defaults; admins change, switch
// off or add features on /admin/announcer, stored in system_settings/announcer as
// features.<key> = { title?, pitch?, howTo?, links?, enabled? }. A stored entry overrides the
// default field by field; a key with no default is an admin-added feature.

/** @param {{ siteOrigin: string, zwiftIdChannelId: string }} links */
function defaultFeatures({ siteOrigin, zwiftIdChannelId }) {
  const site = String(siteOrigin || "").replace(/\/+$/, "");
  return [
    {
      key: "coach",
      title: "DZR Coach",
      pitch: "En træningscoach på Discord, der kender dine data fra intervals.icu og svarer på spørgsmål om din træning, form og planlægning.",
      howTo: "Skriv /coach på serveren og forbind din intervals.icu-konto. Kræver at man er ⭐ Klub Medlem.",
      links: [`${site}/join`],
    },
    {
      key: "ask_bot",
      title: "Spørg DZR-botten",
      pitch: "Botten svarer på spørgsmål om klubben: hold, løb, ZRL, regler, kontingent og Zwift generelt.",
      howTo: "Skriv til botten i en privat besked (DM), eller @mention den i en kanal. Man kan give svarene 👍 eller 👎.",
      links: [],
    },
    {
      key: "route_profiles",
      title: "Ruteprofiler med powerups",
      pitch: "Botten tegner højdeprofilen for en Zwift-rute med sprints, KOM'er og – for løb – hvor powerups ligger.",
      howTo: "Spørg botten, fx \"vis profilen for Watopia's Waistband\" eller \"hvilke powerups er der i dagens ZRL?\".",
      links: [],
    },
    {
      key: "quiz",
      title: "Zwift-quiz",
      pitch: "En hurtig quiz om Zwift-ruter – gæt ruten ud fra profilen.",
      howTo: "Skriv /quiz, eller bed botten om en quiz.",
      links: [],
    },
    {
      key: "rider_stats",
      title: "Rytter- og holdstatistik",
      pitch: "Se ZwiftPower-tal og resultater for dig selv, andre ryttere eller et helt hold.",
      howTo: "Brug /rider_stats, /team_stats eller /browse_riders – eller spørg botten. Link dit Zwift ID først.",
      links: [`<#${zwiftIdChannelId}>`],
    },
    {
      key: "zrl_category",
      title: "Hvilken ZRL-kategori passer til mig?",
      pitch: "Botten vurderer ud fra dine tal, hvilken ZRL-kategori du passer i.",
      howTo: "Spørg botten: \"hvilken ZRL-kategori skal jeg køre?\". Kræver linket Zwift ID.",
      links: [],
    },
    {
      key: "dcu_eserien",
      title: "DCU E-serien",
      pitch: "Botten kender kalenderen og resultaterne for DCU E-serien.",
      howTo: "Spørg botten fx \"hvornår er næste E-serie løb?\" eller \"hvordan gik DZR i E-serien?\".",
      links: [],
    },
    {
      key: "find_events",
      title: "Find Zwift-løb og events",
      pitch: "Botten finder Zwift-events ud fra navn og viser tider, kategorier og rute.",
      howTo: "Spørg botten, fx \"hvornår kører DZR After Party?\".",
      links: [],
    },
    {
      key: "members_zone",
      title: "Members-zone på hjemmesiden",
      pitch: "Som ✅ Verificeret Medlem får du adgang til members-zone på hjemmesiden med din egen side og klubbens data.",
      howTo: "Log ind med Discord på hjemmesiden.",
      links: [`${site}/members-zone`],
    },
    {
      key: "companion_club",
      title: "DZR-klubben i Zwift Companion",
      pitch: "Meld dig ind i DZR-klubben i Zwift Companion-appen, så ser du klubbens events i Zwift og tæller med i klubbens medlemstal.",
      howTo: "Åbn Zwift Companion → Klubber → søg \"Danish Zwift Racers\" → Tilmeld.",
      links: [],
    },
  ];
}

const FIELDS = ["title", "pitch", "howTo", "links", "enabled"];

/**
 * Defaults with the admin's changes, then admin-added features.
 * Each entry: { key, title, pitch, howTo, links, enabled, isDefault, isChanged }.
 */
function resolveFeatures(stored, links) {
  const overrides = stored && typeof stored === "object" ? stored : {};
  const pick = (entry) => Object.fromEntries(FIELDS.filter((field) => entry?.[field] !== undefined).map((field) => [field, entry[field]]));
  const defaults = defaultFeatures(links).map((feature) => {
    const override = pick(overrides[feature.key]);
    return { ...feature, enabled: true, ...override, isDefault: true, isChanged: Object.keys(override).length > 0 };
  });
  const known = new Set(defaults.map((feature) => feature.key));
  const added = Object.entries(overrides)
    .filter(([key, entry]) => !known.has(key) && entry && typeof entry === "object" && entry.title)
    .map(([key, entry]) => ({ key, title: "", pitch: "", howTo: "", links: [], enabled: true, ...pick(entry), isDefault: false, isChanged: true }));
  return [...defaults, ...added];
}

/** A clean stored entry from admin input, or null when the title is missing. */
function sanitizeFeature(input) {
  const text = (value, max) => String(value || "").trim().slice(0, max);
  const title = text(input?.title, 80);
  if (!title) return null;
  const links = (Array.isArray(input?.links) ? input.links : String(input?.links || "").split("\n"))
    .map((link) => String(link).trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((link) => link.slice(0, 300));
  return { title, pitch: text(input?.pitch, 500), howTo: text(input?.howTo, 500), links, enabled: input?.enabled !== false };
}

module.exports = { defaultFeatures, resolveFeatures, sanitizeFeature };
