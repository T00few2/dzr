// The "how DZR Coach works" DM. Sent once, right after intervals.icu is connected (by the site's
// OAuth callback) — or by the bot on /coach if that DM never went out. Copied into apps/bot by
// `npm run sync:shared`, so `../constants.json` resolves to the shared constants in both trees.
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

const EXAMPLE_QUESTIONS = "Spørg fx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*";

function coachHowItWorksText() {
  return [
    "🚴 **DZR Coach**",
    "",
    "Du får træningsråd her i en privat besked fra **DZR Coach** (ikke klub-boten). Sådan virker det:",
    "",
    "**Din træning**",
    "Jeg bruger dine aktiviteter fra intervals.icu, når du spørger om træning, restitution eller et bestemt pas.",
    "",
    "**Opsætning på intervals.icu**",
    "Tjek at det her er på plads, ellers kan jeg ikke se dine ture eller sende pas til Zwift:",
    "1. Settings → Connections: forbind Zwift direkte, og slå upload af planlagte workouts til. Garmin sender ikke Zwift-ture videre.",
    "2. Sæt den samme FTP på Zwift og på intervals.icu.",
    "3. Udendørs ture: forbind Garmin, Wahoo, Polar eller Coros direkte. Ture, der kun er hentet via et andet trænings-API, kan jeg ikke læse.",
    "4. Gamle ture: Download Old Data fra Zwift, eller importér et arkiv med de originale filer.",
    "",
    "**Din profil**",
    "Du har fået et udgangspunkt på profilen (cykling og typisk 3–4 ture om ugen). Du retter selv rammerne under Mine sider → Coach:",
    noEmbedUrl(MY_PAGES_COACH_URL),
    "",
    "Det er der, du sætter hvor ofte du kører, andre sportsgrene, faste træningsdage, skader og hvordan jeg skal svare. Under samme side kan du slå et valgfrit check-in til, så jeg skriver først om morgenen, hvis vi ikke har snakket i et par dage.",
    "",
    "**Feedback**",
    "Reagér med 👍 eller 👎 på mine svar, hvis du vil. Det er anonymt over for de andre og hjælper med at gøre coachingen bedre. Med chat-noter slået til gemmer jeg også, hvilke slags data jeg slog op til svaret — aldrig selve teksten.",
    "",
    "**Kalender**",
    "Du kan planlægge din egen træning og dine løb i kalenderen:",
    noEmbedUrl(CALENDAR_URL),
    "",
    "Den er din — kun du kan se den, og den bliver ikke slettet, selvom du slår coachen fra. Jeg kan altid se den, så jeg kan tage højde for dine løb og planer. Jeg tilføjer kun selv noget, hvis chat-noter er slået til, og det står tydeligt, hvad jeg har lagt ind.",
    "",
    "**Chat-noter**",
    "Chatten er privat. Selve samtalen gemmes ikke. For at forstå sammenhængen kan jeg læse det seneste døgn af vores DM igen — med chat-noter slået til op til 14 dage tilbage, når du henviser til noget tidligere. Det bliver ikke gemt. Med chat-noter slået til gemmer jeg et kort resumé, når en samtale slutter, så jeg kan huske tråden næste gang. Jeg gemmer også stille korte notater (fx at du var syg, eller en engangsplan) — uden at spørge dig. Datobundne mål (et løb, tabe vægt inden en dato) sætter du under Mine sider, eller jeg foreslår dem i chatten og gemmer først, når du trykker Ja. Så styrer jeg træningen efter dem. Faste rammer (ture om ugen, skader, svartone) retter du selv under Mine sider. Du kan altid se og slette noterne der.",
    "",
    "Spørg mig når som helst, hvordan jeg virker, eller hvad jeg gemmer — så får du svar herfra.",
    "",
    EXAMPLE_QUESTIONS,
  ].join("\n");
}

module.exports = {
  MY_PAGES_COACH_URL,
  CALENDAR_URL,
  EXAMPLE_QUESTIONS,
  noEmbedUrl,
  coachHowItWorksText,
};
