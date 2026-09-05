const { MessageFlags } = require("discord.js");
const strava = require("./stravaService");
const { ensureDefaultCoachProfile, markCoachHowItWorksSent } = require("./firebase");
const { MY_PAGES_COACH_URL, coachHowItWorksText, noEmbedUrl } = require("./coachHowItWorks");
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

function sendNoEmbeds(channel, content) {
  return channel.send({ content, flags: MessageFlags.SuppressEmbeds });
}

function stravaConnectText(discordId) {
  const url = strava.getConnectUrl(discordId);
  return (
    "**Strava**\n" +
    "For at give dig træningsråd skal jeg have adgang til dine Strava-aktiviteter.\n\n" +
    "1. Klik på linket (gyldigt 15 minutter)\n" +
    "2. Læs samtykket og forbind Strava\n" +
    "3. Kom tilbage til **DZR Coach** i DM og spørg fx: *Hvordan var min uge?*\n\n" +
    (url ? noEmbedUrl(url) : "⚠️ Connect-link kunne ikke oprettes (STRAVA_CONNECT_SECRET mangler).")
  );
}

function unconnectedCoachText(discordId) {
  return `${coachHowItWorksText({ includeStartHint: false })}\n\n${stravaConnectText(discordId)}`;
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

  const eligible = await strava.hasClubMemberRole(user.id);
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

  const connected = await strava.isStravaConnected(user.id);
  const alreadyExplained = Boolean(profile?.howItWorksSentAt);
  try {
    if (!connected) {
      await sendNoEmbeds(dm, unconnectedCoachText(user.id));
      await markHowItWorksSentSafe(user.id);
      return { ok: true, connected: false, dmChannelId: dm.id };
    }

    if (!alreadyExplained) {
      await sendNoEmbeds(dm, coachHowItWorksText({ includeStartHint: false }));
      await markHowItWorksSentSafe(user.id);
    }

    if (alreadyExplained) {
      await sendNoEmbeds(
        dm,
        "🚴 **DZR Coach** — jeg er klar.\n\n" +
          "Spørg om din træning, restitution, volume eller et specifikt pas. Jeg henter dine Strava-data bag kulissen.\n\n" +
          "Dine rammer retter du på Mine sider → Coach. Chat-noter slår du til samme sted, hvis du vil.\n" +
          noEmbedUrl(MY_PAGES_COACH_URL) +
          "\n\nFx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*"
      );
    } else {
      await sendNoEmbeds(dm, "Jeg er klar. Spørg fx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*");
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
  return "✅ Tjek din DM med **DZR Coach** — forbind Strava via linket, så kan vi chatte om din træning.";
}

async function handleCoach(interaction) {
  const result = await sendCoachingIntroDm(interaction.user);
  await interaction.editReply(replyForIntroResult(result));
  return result;
}

module.exports = {
  handleCoach,
  sendCoachingIntroDm,
  unconnectedCoachText,
  NOT_CLUB_MEMBER_TEXT,
  DM_CLOSED_TEXT,
  COACH_NOT_CONFIGURED_TEXT,
  USE_COACH_BOT_TEXT,
};
