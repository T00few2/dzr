const { ChannelType } = require("discord.js");
const strava = require("./stravaService");
const { ensureDefaultCoachProfile, markCoachHowItWorksSent } = require("./firebase");
const { MY_PAGES_COACH_URL, coachHowItWorksText } = require("./coachHowItWorks");

const NOT_CLUB_MEMBER_TEXT =
  "❌ DZR Coach er kun for **betalende klubmedlemmer** (indeværende år).\n\n" +
  "Verified Member / community er ikke nok — du skal have aktivt klubmedlemskab.\n" +
  "Bliv klubmedlem: https://www.dzrracingseries.com/join";

const DM_CLOSED_TEXT =
  "❌ Jeg kunne ikke sende dig en DM. Tillad beskeder fra servermedlemmer (Discord → Privatliv / Privacy) og prøv `/coach` igen.";

async function sendCoachingIntroDm(user, client, guild = null) {
  const eligible = await strava.hasClubMemberRole(user.id, client, guild);
  if (!eligible) {
    return { ok: false, reason: "not_club_member" };
  }

  let dm;
  try {
    dm = await user.createDM();
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
    if (!alreadyExplained) {
      await dm.send(coachHowItWorksText({ includeStartHint: false }));
      try {
        await markCoachHowItWorksSent(user.id);
      } catch (err) {
        console.warn("markCoachHowItWorksSent failed:", err?.message || err);
      }
    }

    if (!connected) {
      const url = strava.getConnectUrl(user.id);
      await dm.send(
        "For at give dig træningsråd skal jeg have adgang til dine Strava-aktiviteter.\n\n" +
          "1. Klik på linket (gyldigt 15 minutter)\n" +
          "2. Læs samtykket og forbind Strava\n" +
          "3. Kom tilbage hertil og spørg fx: *Hvordan var min uge?*\n\n" +
          (url || "⚠️ Connect-link kunne ikke oprettes (STRAVA_CONNECT_SECRET mangler).")
      );
      return { ok: true, connected: false, dmChannelId: dm.id };
    }

    if (alreadyExplained) {
      await dm.send(
        "🚴 **DZR Coach** — jeg er klar.\n\n" +
          "Spørg om din træning, restitution, volume eller et specifikt pas. Jeg henter dine Strava-data bag kulissen.\n\n" +
          "Dine rammer retter du på Mine sider → Coach. Chat-noter slår du til samme sted, hvis du vil.\n" +
          MY_PAGES_COACH_URL +
          "\n\nFx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*"
      );
    } else {
      await dm.send("Jeg er klar. Spørg fx: *Hvordan var min uge?* · *Var i går for hård?* · *Skal jeg hvile i morgen?*");
    }
    return { ok: true, connected: true, dmChannelId: dm.id };
  } catch {
    return { ok: false, reason: "dm_closed" };
  }
}

function replyForIntroResult(result) {
  if (!result?.ok && result?.reason === "not_club_member") return NOT_CLUB_MEMBER_TEXT;
  if (!result?.ok) return DM_CLOSED_TEXT;
  if (result.connected) return "✅ Tjek din DM — coach-chatten er klar der.";
  return "✅ Tjek din DM — forbind Strava via linket, så kan vi chatte om din træning.";
}

async function handleCoach(interaction) {
  const result = await sendCoachingIntroDm(
    interaction.user,
    interaction.client,
    interaction.guild
  );

  if (interaction.channel?.type === ChannelType.DM && result.ok) {
    await interaction.editReply(
      result.connected
        ? "✅ Coach-session startet her i DM. Spørg løs om din træning."
        : "✅ Forbind Strava via linket ovenfor, så kan vi chatte om din træning."
    );
    return result;
  }

  await interaction.editReply(replyForIntroResult(result));
  return result;
}

async function handoffCoachingFromMessage(message, client) {
  const result = await sendCoachingIntroDm(message.author, client, message.guild);

  if (message.channel?.type !== ChannelType.DM) {
    try {
      if (!result.ok && result.reason === "not_club_member") {
        await message.reply(NOT_CLUB_MEMBER_TEXT);
      } else if (!result.ok) {
        await message.reply(DM_CLOSED_TEXT);
      } else {
        await message.reply("📬 Jeg sender coaching i en **privat DM** — tjek din indbakke.");
      }
    } catch (err) {
      console.warn("handoffCoachingFromMessage channel reply failed:", err?.message || err);
    }
  } else if (!result.ok) {
    try {
      await message.reply(result.reason === "not_club_member" ? NOT_CLUB_MEMBER_TEXT : DM_CLOSED_TEXT);
    } catch {
      /* ignore */
    }
  }

  return result;
}

module.exports = {
  handleCoach,
  sendCoachingIntroDm,
  handoffCoachingFromMessage,
  NOT_CLUB_MEMBER_TEXT,
  DM_CLOSED_TEXT,
};
