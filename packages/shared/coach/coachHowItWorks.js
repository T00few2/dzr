// The "how DZR Coach works" DM, plus the short setup pointer that replaced it as the first message.
// The essay is posted when someone asks how the coach works. The pointer is what they get the
// moment intervals.icu connects. Copied into apps/bot by `npm run sync:shared`, so
// `../constants.json` resolves to the shared constants in both trees.
const { siteOrigin } = require("../constants.json");

const MY_PAGES_COACH_URL = `${siteOrigin}/members-zone/my-pages?tab=2`;
// Its own section rather than a Coach tab: every verified member has a calendar, including those
// who never open the coach, and My Pages is where you change settings, not where you plan a week.
const CALENDAR_URL = `${siteOrigin}/members-zone/calendar`;
// The page they land on after OAuth. The setup itself lives here, not in the DM.
const SETUP_URL = `${siteOrigin}/intervals/connected`;

function noEmbedUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("<") && raw.endsWith(">")) return raw;
  return `<${raw}>`;
}

const EXAMPLE_QUESTIONS = "Spørg fx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*";
const FIRST_QUESTION = "Spørg fx: *Hvordan var min uge?*";

/**
 * The first setup step that is still open, or "done".
 *
 * Skipping a step finishes it. The calendar counts as done when the member already has any
 * entry, including ones that survived a coach disconnect. This does not look at the finished
 * latch — a finished setup stays closed even if a step would otherwise look open again.
 */
function coachSetupStep(profile, { hasCalendarEntry = false } = {}) {
  const notesDone = profile?.notesOptIn === true || Boolean(profile?.onboardingNotesSkippedAt);
  const weekly = Array.isArray(profile?.weekly) ? profile.weekly : [];
  const weeklyDone = weekly.length > 0 || Boolean(profile?.onboardingWeeklySkippedAt);
  const calendarDone = Boolean(hasCalendarEntry) || Boolean(profile?.onboardingCalendarSkippedAt);
  if (!notesDone) return "notes";
  if (!weeklyDone) return "days";
  if (!calendarDone) return "calendar";
  return "done";
}

/**
 * True while at least one setup step is still open.
 *
 * A finished setup stays finished: turning notes off later, or clearing a day, must not bring
 * the wizard back.
 */
function isCoachSetupOpen(profile, options) {
  if (profile?.onboardingFinishedAt) return false;
  return coachSetupStep(profile, options) !== "done";
}

function coachSetupPointerText() {
  return [
    "✅ **intervals.icu er forbundet.**",
    "",
    "Tjek at Zwift er forbundet direkte, at upload af planlagte workouts er slået til, og at FTP er den samme på Zwift og intervals.icu.",
    "",
    "Tre korte trin gør coachen bedre — chat-noter, faste dage og kalenderen:",
    noEmbedUrl(SETUP_URL),
    "",
    "Du kan også spørge med det samme.",
    "",
    FIRST_QUESTION,
  ].join("\n");
}

function coachSetupNudgeText() {
  return [
    "🚴 **DZR Coach** — jeg er klar.",
    "",
    "Tre korte trin gør svarene bedre: chat-noter, dine faste dage, og ét løb eller en plan i kalenderen.",
    noEmbedUrl(SETUP_URL),
    "",
    FIRST_QUESTION,
  ].join("\n");
}

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
  SETUP_URL,
  EXAMPLE_QUESTIONS,
  noEmbedUrl,
  coachHowItWorksText,
  coachSetupPointerText,
  coachSetupNudgeText,
  isCoachSetupOpen,
  coachSetupStep,
};
