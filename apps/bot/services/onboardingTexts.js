// Source of truth; copied to apps/bot by npm run sync:shared.
//
// The texts of the bot's onboarding DMs. Admins can replace any of them on /admin/onboarding; the
// replacement is stored in system_settings/onboarding_texts as texts.<key>. An empty or missing
// replacement means the default below.
//
// Placeholders such as {fee} are filled in when the DM is sent. A line whose placeholder has no
// value (no fee known, no teams looking for riders) is left out, so write such a placeholder on a
// line of its own.

const MAX_ONBOARDING_CHARS = 1800;

const ONBOARDING_TEXT_SPECS = {
  join: { label: "Welcome DM (on joining the server)", placeholders: { name: "The member's display name" } },
  intro: { label: "Server intro (sent with the first step)", placeholders: {} },
  link_zwift_id_channel: { label: "Step: link Zwift ID (not paid)", placeholders: {} },
  link_zwift_id_join: { label: "Step: link Zwift ID (paid on /join)", placeholders: {} },
  meet_verification: { label: "Step: other verification criteria", placeholders: { missing: "The missing criteria, one bullet per line" } },
  become_club_member: { label: "Step: become a club member", placeholders: { fee: "The current membership fee" } },
  club_role_pending: { label: "Step: club role pending", placeholders: {} },
  connect_intervals: { label: "Step: club welcome (DZR Coach, intervals.icu)", placeholders: { teams: "Teams looking for riders right now" } },
  ask_me: { label: "Closing line on every step DM", placeholders: {} },
  dm_closed_fallback: { label: "Channel message when DMs are closed", placeholders: { mention: "@mention of the member" } },
};

/** @param {{ siteOrigin: string, channels: Record<string, string> }} links */
function defaultOnboardingTexts({ siteOrigin, channels }) {
  const site = String(siteOrigin || "").replace(/\/+$/, "");
  const askMe = "Spørg mig om hvad som helst her i DM – hold, løb, ZRL-kategori, Zwift. Giv gerne mine svar 👍 eller 👎, så jeg bliver bedre. _(You can write to me in English.)_";
  return {
    join: [
      "Hej {name} 👋 Velkommen til **Danish Zwift Racers**!",
      "Jeg er DZR-botten. Når du er kommet helt ind på serveren, guider jeg dig videre herinde.",
      askMe,
    ].join("\n\n"),
    intro: [
      "**Kom godt i gang på DZR Discord**",
      `• <#${channels.selfRoles}> – vælg løbsserier og hold, så du ser de rigtige kanaler`,
      `• <#${channels.teamsLookingForRiders}> – hold der leder efter ryttere`,
      `• <#${channels.announcements}> – vigtige opdateringer`,
      `• <#${channels.raceSchedule}> – hvilke løb vi kører`,
      `• <#${channels.help}> – få hjælp`,
      "• DZR-kittet i Zwift får du ved at gennemføre et DZR-event med kittet som præmie – spørg mig hvilke.",
    ].join("\n"),
    link_zwift_id_channel: [
      "**Næste skridt: link dit Zwift ID** → så bliver du ✅ Verificeret Medlem og får adgang til members-zone på hjemmesiden og bot-kommandoerne.",
      `Skriv \`zwiftid 1234567\` (dit eget ID) i <#${channels.zwiftId}>, brug \`/my_zwiftid\` – eller send det bare til mig her. Jeg viser dig profilen, så du kan bekræfte, at det er dig.`,
      "Kender du ikke dit ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
    ].join("\n"),
    link_zwift_id_join: [
      "**Tak for din betaling! Sidste skridt: link dit Zwift ID**",
      `Gør det her: ${site}/join/zwift-id – så er du både ⭐ Klub Medlem og ✅ Verificeret Medlem.`,
      "Kender du ikke dit Zwift ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig og viser profilen, så du kan bekræfte.",
    ].join("\n"),
    meet_verification: [
      "**Næste skridt for at blive ✅ Verificeret Medlem:**",
      "{missing}",
    ].join("\n"),
    become_club_member: [
      "**Du er nu ✅ Verificeret Medlem 🎉**",
      "Næste skridt, hvis du vil: bliv ⭐ **Klub Medlem**. Det giver bl.a. adgang til DZR Coach – en træningscoach her på Discord, der kender dine data.",
      "Kontingent: {fee}.",
      `Meld dig ind her: ${site}/join`,
    ].join("\n"),
    club_role_pending: [
      "**Din ⭐ Klub Medlem-status er ved at blive opdateret**",
      `Din betaling og din rolle her på Discord passer ikke sammen endnu. Det retter sig som regel selv kort efter – ellers skriv i <#${channels.help}>, så hjælper en admin.`,
    ].join("\n"),
    connect_intervals: [
      "**Velkommen som ⭐ Klub Medlem 🥳**",
      "Som klubmedlem kan du bruge **DZR Coach**. Skriv `/coach` på serveren, så får du et link til at forbinde din intervals.icu-konto, og coachen skriver til dig.",
      `Leder du efter et hold? Se <#${channels.teamsLookingForRiders}> eller spørg mig.`,
      "Disse hold søger ryttere lige nu: {teams}.",
    ].join("\n"),
    ask_me: askMe,
    dm_closed_fallback: "{mention} Jeg kunne ikke sende dig en DM. Åbn for DMs fra servermedlemmer, eller @mention mig her, så hjælper jeg dig i gang.",
  };
}

/** Every key's text: the admin's replacement when there is one, else the default. */
function resolveOnboardingTexts(stored, links) {
  const defaults = defaultOnboardingTexts(links);
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const custom = typeof stored?.[key] === "string" ? stored[key].trim() : "";
    if (custom) out[key] = custom.slice(0, MAX_ONBOARDING_CHARS);
  }
  return out;
}

/**
 * Fill in placeholders. vars holds the placeholders this text may use; a line using one whose
 * value is empty is dropped. Unknown {words} are left as written.
 */
function renderTemplate(template, vars = {}) {
  const lines = [];
  for (const line of String(template || "").split("\n")) {
    let drop = false;
    const rendered = line.replace(/\{(\w+)\}/g, (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;
      const value = vars[name] == null ? "" : String(vars[name]);
      if (!value) drop = true;
      return value;
    });
    if (!drop) lines.push(rendered);
  }
  return lines.join("\n").trim();
}

module.exports = { MAX_ONBOARDING_CHARS, ONBOARDING_TEXT_SPECS, defaultOnboardingTexts, resolveOnboardingTexts, renderTemplate };
