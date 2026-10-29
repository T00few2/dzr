/**
 * Existing features the announcer spotlights, one at a time, longest-unfeatured first.
 *
 * Facts only: the model writes the post from these and may not add to them. Add a feature here
 * when it ships; newly shipped features from the commit log are also spotlighted once, a month
 * after their news post (see signals.featureSpotlight).
 */
const shared = require("../../constants.json");

const SITE = String(shared.siteOrigin || "").replace(/\/+$/, "");
const CHANNELS = shared.discord.channels;

const FEATURES = [
  {
    key: "coach",
    title: "DZR Coach",
    pitch: "En træningscoach på Discord, der kender dine data fra intervals.icu og svarer på spørgsmål om din træning, form og planlægning.",
    howTo: "Skriv /coach på serveren og forbind din intervals.icu-konto. Kræver at man er ⭐ Klub Medlem.",
    links: [`${SITE}/join`],
  },
  {
    key: "ask_bot",
    title: "Spørg DZR-botten",
    pitch: "Botten svarer på spørgsmål om klubben: hold, løb, ZRL, regler, kontingent og Zwift generelt.",
    howTo: "Skriv til botten i en privat besked (DM), eller @mention den i en kanal. Man kan give svarene 👍 eller 👎.",
  },
  {
    key: "route_profiles",
    title: "Ruteprofiler med powerups",
    pitch: "Botten tegner højdeprofilen for en Zwift-rute med sprints, KOM'er og – for løb – hvor powerups ligger.",
    howTo: "Spørg botten, fx \"vis profilen for Watopia's Waistband\" eller \"hvilke powerups er der i dagens ZRL?\".",
  },
  {
    key: "quiz",
    title: "Zwift-quiz",
    pitch: "En hurtig quiz om Zwift-ruter – gæt ruten ud fra profilen.",
    howTo: "Skriv /quiz, eller bed botten om en quiz.",
  },
  {
    key: "rider_stats",
    title: "Rytter- og holdstatistik",
    pitch: "Se ZwiftPower-tal og resultater for dig selv, andre ryttere eller et helt hold.",
    howTo: "Brug /rider_stats, /team_stats eller /browse_riders – eller spørg botten. Link dit Zwift ID først.",
    links: [`<#${CHANNELS.zwiftId}>`],
  },
  {
    key: "zrl_category",
    title: "Hvilken ZRL-kategori passer til mig?",
    pitch: "Botten vurderer ud fra dine tal, hvilken ZRL-kategori du passer i.",
    howTo: "Spørg botten: \"hvilken ZRL-kategori skal jeg køre?\". Kræver linket Zwift ID.",
  },
  {
    key: "dcu_eserien",
    title: "DCU E-serien",
    pitch: "Botten kender kalenderen og resultaterne for DCU E-serien.",
    howTo: "Spørg botten fx \"hvornår er næste E-serie løb?\" eller \"hvordan gik DZR i E-serien?\".",
  },
  {
    key: "find_events",
    title: "Find Zwift-løb og events",
    pitch: "Botten finder Zwift-events ud fra navn og viser tider, kategorier og rute.",
    howTo: "Spørg botten, fx \"hvornår kører DZR After Party?\".",
  },
  {
    key: "members_zone",
    title: "Members-zone på hjemmesiden",
    pitch: "Som ✅ Verificeret Medlem får du adgang til members-zone på hjemmesiden med din egen side og klubbens data.",
    howTo: "Log ind med Discord på hjemmesiden.",
    links: [`${SITE}/members-zone`],
  },
  {
    key: "companion_club",
    title: "DZR-klubben i Zwift Companion",
    pitch: "Meld dig ind i DZR-klubben i Zwift Companion-appen, så ser du klubbens events i Zwift og tæller med i klubbens medlemstal.",
    howTo: "Åbn Zwift Companion → Klubber → søg \"Danish Zwift Racers\" → Tilmeld.",
  },
];

module.exports = { FEATURES };
