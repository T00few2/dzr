const { siteOrigin } = require("../constants.json");

const MY_PAGES_COACH_URL = `${siteOrigin}/members-zone/my-pages?tab=2`;
// Its own section rather than a Coach tab: every verified member has a calendar, including those
// who never open the coach, and My Pages is where you change settings, not where you plan a week.
const CALENDAR_URL = `${siteOrigin}/members-zone/calendar`;

function noEmbedUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("<") && raw.endsWith(">")) return raw;
  return `<${raw}>`;
}

function coachHowItWorksText({ includeStartHint = false } = {}) {
  const lines = [
    "🚴 **DZR Coach**",
    "",
    "Du kan få træningsråd i en privat besked fra **DZR Coach** (ikke klub-boten). Sådan virker det:",
    "",
    "**Din træning**",
    "Jeg bruger dine Strava-aktiviteter, når du spørger om træning, restitution eller et bestemt pas.",
    "",
    "**Din profil**",
    "Du har fået et udgangspunkt på profilen (cykling og typisk 3–4 ture om ugen). Du retter selv rammerne under Mine sider → Coach:",
    noEmbedUrl(MY_PAGES_COACH_URL),
    "",
    "Det er der, du sætter hvor ofte du kører, andre sportsgrene, faste træningsdage, skader og hvordan jeg skal svare. Under samme side kan du slå et valgfrit check-in til, så jeg skriver først om morgenen, hvis vi ikke har snakket i et par dage.",
    "",
    "**Feedback**",
    "Reagér med 👍 eller 👎 på mine svar, hvis du vil. Det er anonymt over for de andre og hjælper med at gøre coachingen bedre.",
    "",
    "**Kalender**",
    "Du kan planlægge din egen træning og dine løb i kalenderen:",
    noEmbedUrl(CALENDAR_URL),
    "",
    "Den er din — kun du kan se den, og den bliver ikke slettet, selvom du slår coachen fra. Jeg kan altid se den, så jeg kan tage højde for dine løb og planer. Jeg tilføjer kun selv noget, hvis chat-noter er slået til, og det står tydeligt, hvad jeg har lagt ind.",
    "",
    "**Chat-noter**",
    "Chatten er privat. Selve samtalen gemmes ikke — men når en samtale slutter, gemmer jeg et kort resumé af den, så jeg kan huske tråden næste gang. Når chat-noter er slået til, gemmer jeg stille korte notater (fx at du var syg, eller en engangsplan) — uden at spørge dig. Datobundne mål (et løb, tabe vægt inden en dato) sætter du under Mine sider, eller jeg foreslår dem i chatten og gemmer først, når du trykker Ja. Så styrer jeg træningen efter dem. Faste rammer (ture om ugen, skader, svartone) retter du selv under Mine sider. Du kan altid se og slette noterne der.",
  ];
  if (includeStartHint) {
    lines.push("", "Skriv **/coach** på Discord-serveren, når du vil i gang. **DZR Coach** skriver til dig i en privat besked.");
  }
  return lines.join("\n");
}

module.exports = {
  MY_PAGES_COACH_URL,
  CALENDAR_URL,
  noEmbedUrl,
  coachHowItWorksText,
};
