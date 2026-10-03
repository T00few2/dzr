const { MessageFlags } = require("discord.js");
const intervals = require("./intervalsService");
const { ensureDefaultCoachProfile, markCoachHowItWorksSent } = require("./firebase");
const { MY_PAGES_COACH_URL, EXAMPLE_QUESTIONS, coachHowItWorksText, noEmbedUrl } = require("./coachHowItWorks");
const { getCoachClient, isCoachBotConfigured } = require("./coachBot");

const NOT_CLUB_MEMBER_TEXT =
  "❌ DZR Coach er kun for **betalende klubmedlemmer** (indeværende år).\n\n" +
  "Verified Member / community er ikke nok — du skal have aktivt klubmedlemskab.\n" +
  "Bliv klubmedlem: " + noEmbedUrl("https://www.dzrracingseries.com/join");

const DM_CLOSED_TEXT =
  "❌ Jeg kunne ikke sende dig en DM fra **DZR Coach**. Tillad beskeder fra servermedlemmer (Discord → Privatliv / Privacy) og prøv `/coach` igen.";

const COACH_NOT_CONFIGURED_TEXT =
  "⚠️ DZR Coach er ikke sat op endnu. Prøv igen lidt senere, eller skriv til support hvis det bliver ved.";

const USE_COACH_BOT_TEXT =
  "🚴 Coaching sker hos **DZR Coach**. Skriv `/coach` på serveren — så åbner jeg en privat chat med DZR Coach.\n\n" +
  "Skriv videre her, hvis det handler om klubben (stats, hold, quiz).";

function splitDiscordContent(content, limit = 1900) {
  const text = String(content || "").trim();
  if (!text) return [];
  if (text.length <= limit) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.5) cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function sendNoEmbeds(channel, content) {
  const chunks = splitDiscordContent(content);
  return chunks.reduce(
    (prev, chunk) => prev.then(() => channel.send({ content: chunk, flags: MessageFlags.SuppressEmbeds })),
    Promise.resolve()
  );
}

function intervalsConnectText(discordId) {
  const url = intervals.getConnectUrl(discordId);
  return (
    "**intervals.icu**\n" +
    "For at give dig træningsråd skal jeg have adgang til dine aktiviteter på intervals.icu.\n\n" +
    "Før du klikker:\n" +
    "1. Opret en konto på intervals.icu\n" +
    "2. Forbind **Zwift** direkte under Settings → Connections, og slå upload af planlagte workouts til\n" +
    "3. Sæt den samme FTP på Zwift og på intervals.icu\n" +
    "4. Udendørs ture: forbind Garmin, Wahoo, Polar eller Coros direkte\n\n" +
    "Så:\n" +
    "1. Klik på linket (gyldigt 15 minutter)\n" +
    "2. Læs samtykket og forbind intervals.icu\n" +
    "3. Kom tilbage hertil og spørg fx: *Hvordan var min uge?*\n\n" +
    (url ? noEmbedUrl(url) : "⚠️ Connect-link kunne ikke oprettes (COACH_CONNECT_SECRET mangler).")
  );
}

function unconnectedCoachText(discordId) {
  return (
    "🚴 **DZR Coach**\n\n" +
    "Jeg er din træningscoach her i DM. Jeg kan læse dine pas og give råd, når intervals.icu er forbundet. Når det er gjort, får du en kort besked om, hvordan det hele virker.\n\n" +
    "Har du brugt coachen før, er din profil, dine noter og din kalender der stadig.\n\n" +
    intervalsConnectText(discordId) +
    "\n\nHvis intervals.icu siger, at appen afventer godkendelse, virker linket først, når den er godkendt. Skriv til mig igen bagefter."
  );
}

async function markHowItWorksSentSafe(discordId) {
  try {
    await markCoachHowItWorksSent(discordId);
  } catch (err) {
    console.warn("markCoachHowItWorksSent failed:", err?.message || err);
  }
}

async function sendCoachingIntroDm(user) {
  if (!isCoachBotConfigured()) {
    return { ok: false, reason: "coach_not_configured" };
  }

  const eligible = await intervals.hasClubMemberRole(user.id);
  if (!eligible) {
    return { ok: false, reason: "not_club_member" };
  }

  const coachClient = await getCoachClient();
  if (!coachClient) {
    return { ok: false, reason: "coach_not_configured" };
  }

  let dm;
  try {
    const coachUser = await coachClient.users.fetch(user.id);
    dm = await coachUser.createDM();
  } catch {
    return { ok: false, reason: "dm_closed" };
  }

  let profile = null;
  try {
    profile = await ensureDefaultCoachProfile(user.id);
  } catch (err) {
    console.warn("ensureDefaultCoachProfile failed:", err?.message || err);
  }

  const connected = await intervals.isConnected(user.id);
  const alreadyExplained = Boolean(profile?.howItWorksSentAt);
  try {
    // Not stamped as explained here: this message is about connecting, and the how-it-works DM
    // follows once they have (sent by the site's intervals.icu callback).
    if (!connected) {
      await sendNoEmbeds(dm, unconnectedCoachText(user.id));
      return { ok: true, connected: false, dmChannelId: dm.id };
    }

    if (!alreadyExplained) {
      await sendNoEmbeds(dm, coachHowItWorksText());
      await markHowItWorksSentSafe(user.id);
    } else {
      await sendNoEmbeds(
        dm,
        "🚴 **DZR Coach** — jeg er klar.\n\n" +
          "Spørg om din træning, restitution, volume eller et specifikt pas. Jeg henter dine intervals.icu-data bag kulissen.\n\n" +
          "Dine rammer retter du på Mine sider → Coach. Chat-noter slår du til samme sted, hvis du vil.\n" +
          noEmbedUrl(MY_PAGES_COACH_URL) +
          "\n\n" + EXAMPLE_QUESTIONS
      );
    }
    return { ok: true, connected: true, dmChannelId: dm.id };
  } catch {
    return { ok: false, reason: "dm_closed" };
  }
}

function replyForIntroResult(result) {
  if (!result?.ok && result?.reason === "coach_not_configured") return COACH_NOT_CONFIGURED_TEXT;
  if (!result?.ok && result?.reason === "not_club_member") return NOT_CLUB_MEMBER_TEXT;
  if (!result?.ok) return DM_CLOSED_TEXT;
  if (result.connected) return "✅ Tjek din DM med **DZR Coach** — coach-chatten er klar der.";
  return "✅ Tjek din DM med **DZR Coach** — forbind intervals.icu via linket, så kan vi chatte om din træning.";
}

async function handleCoach(interaction) {
  const result = await sendCoachingIntroDm(interaction.user);
  await interaction.editReply(replyForIntroResult(result));
  return result;
}

module.exports = {
  handleCoach,
  sendCoachingIntroDm,
  sendNoEmbeds,
  unconnectedCoachText,
  NOT_CLUB_MEMBER_TEXT,
  DM_CLOSED_TEXT,
  COACH_NOT_CONFIGURED_TEXT,
  USE_COACH_BOT_TEXT,
};
