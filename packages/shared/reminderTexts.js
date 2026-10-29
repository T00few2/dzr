// Source of truth; copied to apps/bot by npm run sync:shared.
//
// The texts of the bot's DM reminders. Admins can replace any of them on /admin/onboarding; the
// replacement is stored in system_settings/announcer as dmReminders.texts.<step>. An empty or
// missing replacement means the default below, so a reset is deleting the stored text.

const MAX_REMINDER_CHARS = 1800;

const REMINDER_STEP_LABELS = {
  link_zwift_id_channel: "Link Zwift ID (not paid)",
  link_zwift_id_join: "Link Zwift ID (paid on /join)",
  connect_intervals: "Connect intervals.icu for DZR Coach",
  join_companion: "Join DZR in Zwift Companion",
};

const INTRO = "👋 Lille påmindelse fra DZR-botten";
const OUTRO = "Har du spørgsmål, så skriv til mig her – jeg hjælper gerne. _(You can write to me in English.)_";

/**
 * The default text for every reminder step.
 * @param {{ siteOrigin: string, zwiftIdChannelId: string }} links
 */
function defaultReminderTexts({ siteOrigin, zwiftIdChannelId }) {
  const site = String(siteOrigin || "").replace(/\/+$/, "");
  const wrap = (...lines) => [INTRO, lines.join("\n"), OUTRO].join("\n\n");
  return {
    link_zwift_id_channel: wrap(
      "**Du mangler stadig at linke dit Zwift ID** → så bliver du ✅ Verificeret Medlem og får adgang til members-zone på hjemmesiden og bot-kommandoerne.",
      `Skriv \`zwiftid 1234567\` (dit eget ID) i <#${zwiftIdChannelId}>, brug \`/my_zwiftid\` – eller send det bare til mig her.`,
      "Kender du ikke dit ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
    ),
    link_zwift_id_join: wrap(
      "**Du mangler stadig at linke dit Zwift ID**",
      `Gør det her: ${site}/join/zwift-id – så er du både ⭐ Klub Medlem og ✅ Verificeret Medlem.`,
      "Kender du ikke dit Zwift ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
    ),
    connect_intervals: wrap(
      "**Har du prøvet DZR Coach?**",
      "Som ⭐ Klub Medlem kan du bruge DZR Coach – en træningscoach her på Discord, der kender dine data og svarer på spørgsmål om din træning.",
      "Skriv `/coach` på serveren, så får du et link til at forbinde din intervals.icu-konto.",
    ),
    join_companion: wrap(
      "**Er du med i DZR-klubben i Zwift Companion?**",
      "Meld dig ind i DZR-klubben i Zwift Companion-appen, så ser du klubbens events i Zwift og tæller med i klubbens medlemstal.",
      "Åbn Zwift Companion → Klubber → søg \"Danish Zwift Racers\" → Tilmeld.",
    ),
  };
}

/** The text to send for a step: the admin's replacement when there is one, else the default. */
function resolveReminderText(step, stored, links) {
  const custom = typeof stored?.[step] === "string" ? stored[step].trim() : "";
  if (custom) return custom.slice(0, MAX_REMINDER_CHARS);
  return defaultReminderTexts(links)[step] || null;
}

module.exports = { MAX_REMINDER_CHARS, REMINDER_STEP_LABELS, defaultReminderTexts, resolveReminderText };
