const OpenAI = require("openai");
const config = require("../config/config");
const strava = require("./stravaService");
const { getCoachClient } = require("./coachBot");
const { sendNoEmbeds } = require("./coachDm");
const {
  listCoachProfiles,
  listCoachChatNotes,
  markCoachFollowUpSent,
  recordCoachUsage,
  getBotState,
  setBotState,
} = require("./firebase");
const { formatCoachProfileForPrompt } = require("./coachProfile");
const {
  retrieveRelevantNotes,
  formatNotesForPrompt,
  formatActiveGoalsForPrompt,
  formatCoachToday,
} = require("./coachChatNotes");

const {
  FOLLOW_UP_TZ,
  FOLLOW_UP_HOUR,
  shouldRunFollowUpSweep,
  isFollowUpDue,
} = require("./coachFollowUpSchedule");

const FOLLOW_UP_STATE_KEY = "coach_follow_up";
const MAX_FOLLOW_UPS_PER_RUN = 25;
const MODEL = "gpt-5-mini";
const FALLBACK_DA = "Hvordan går træningen? Skriv hvis du vil have et kig på ugen.";
const FALLBACK_EN = "How is training going? Write if you want a look at the week.";

let openai = null;
try {
  if (config.openai?.apiKey) {
    openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
} catch {
  openai = null;
}

function formatActivitiesForPrompt(activities) {
  const list = Array.isArray(activities) ? activities.slice(0, 12) : [];
  if (!list.length) return "(no recent Strava activities)";
  return list
    .map((a) => {
      const date = String(a.start_date || "").slice(0, 10) || "unknown date";
      const km = typeof a.distance_m === "number" ? `${(a.distance_m / 1000).toFixed(1)} km` : "";
      const min = typeof a.moving_time === "number" ? `${Math.round(a.moving_time / 60)} min` : "";
      const watts = typeof a.average_watts === "number" ? `${Math.round(a.average_watts)} W` : "";
      const hr = typeof a.average_heartrate === "number" ? `${Math.round(a.average_heartrate)} bpm` : "";
      const name = a.name || a.sport_type || "session";
      return `- ${date} — ${name}${km ? `, ${km}` : ""}${min ? `, ${min}` : ""}${watts ? `, ${watts}` : ""}${hr ? `, ${hr}` : ""}`;
    })
    .join("\n");
}

function getMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  return "";
}

function extractTokenUsage(response) {
  const u = response?.usage || {};
  const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const totalTokens = Number(u.total_tokens ?? 0) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

async function generateFollowUpText({ profile, activities, notesBlock, goalsBlock, username }) {
  const language = profile?.style?.language === "en" ? "en" : "da";
  const fallback = language === "en" ? FALLBACK_EN : FALLBACK_DA;
  if (!openai) return fallback;

  const today = formatCoachToday();
  const settings = formatCoachProfileForPrompt(profile);
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 220,
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `You write one short proactive check-in from DZR Coach to an athlete in a Discord DM.
Rules:
- Reply in ${language === "en" ? "English" : "Danish"}.
- Discord-short: a few sentences, one question.
- Cite a real recent session (date, duration, power/HR) only if it appears in the Strava list. Never invent numbers.
- Weeks start Monday (Denmark / ISO). Sunday is the last day of the week.
- If Active goals lists any, default the check-in toward the nearest dated goal. Injuries still override.
- Use Coach settings and chat notes as hints. Do not say you saved a note or changed settings.
- If a chat note records advice you gave (kind "plan"), check it against the Strava list and lead with that: whether it happened, and how it went. Following up on your own advice is the point of a check-in. Ask, do not accuse — a missed session usually has a reason worth hearing.
- Not medical advice. No doping or extreme restriction.
- Do not mention tokens, Firestore, or this being a scheduled job.`,
      },
      {
        role: "user",
        content: `${today.line}

Athlete: ${username || "athlete"}

## Coach settings
${settings}

## Active goals
${goalsBlock || "No saved goals."}

## Chat notes
${notesBlock || "(none)"}

## Recent Strava (last 14 days)
${formatActivitiesForPrompt(activities)}

Write the check-in now.`,
      },
    ],
  });

  const usage = extractTokenUsage(response);
  if (usage.totalTokens > 0 || usage.promptTokens > 0) {
    await recordCoachUsage({
      discordId: profile.discordId,
      username: username || null,
      model: MODEL,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      openaiCalls: 1,
    });
  }

  return getMessageText(response.choices[0]?.message) || fallback;
}

async function sendFollowUpDm(discordId, text) {
  const coachClient = await getCoachClient();
  if (!coachClient) throw new Error("coach_not_configured");
  const user = await coachClient.users.fetch(discordId);
  const dm = await user.createDM();
  await sendNoEmbeds(dm, String(text || "").trim());
}

async function sendOneFollowUp(profile) {
  const discordId = String(profile.discordId || "").trim();
  if (!discordId) return;
  const eligible = await strava.hasClubMemberRole(discordId);
  if (!eligible) return;
  const connected = await strava.isStravaConnected(discordId);
  if (!connected) return;

  let activities = [];
  try {
    const result = await strava.getRecentActivities(discordId, { days: 14 });
    if (result?.success && Array.isArray(result.activities)) activities = result.activities;
  } catch (err) {
    console.warn("coach follow-up Strava failed:", err?.message || err);
  }

  let notesBlock = "";
  let goalsBlock = "No saved goals.";
  if (profile.notesOptIn === true) {
    try {
      const notes = await listCoachChatNotes(discordId);
      goalsBlock = formatActiveGoalsForPrompt(notes);
      const hits = retrieveRelevantNotes(notes, "training week follow up", { now: new Date() });
      notesBlock = formatNotesForPrompt(hits.filter((note) => note.kind !== "goal")) || "";
    } catch (err) {
      console.warn("coach follow-up notes failed:", err?.message || err);
    }
  }

  let username = null;
  try {
    const coachClient = await getCoachClient();
    const user = await coachClient?.users.fetch(discordId);
    username = user?.username || null;
  } catch {
    username = null;
  }

  const text = await generateFollowUpText({ profile, activities, notesBlock, goalsBlock, username });
  try {
    await sendFollowUpDm(discordId, text);
  } catch (err) {
    console.warn("coach follow-up DM failed:", discordId, err?.message || err);
  }
  await markCoachFollowUpSent(discordId);
}

async function maybeSendCoachFollowUps(now = new Date()) {
  const existing = await getBotState(FOLLOW_UP_STATE_KEY);
  const decision = shouldRunFollowUpSweep({ now, lastRunDate: existing?.lastRunDate || null });
  if (!decision.run) return { skipped: decision.reason };
  const todayKey = decision.todayKey;

  const due = [];
  try {
    const profiles = await listCoachProfiles();
    for (const profile of profiles) {
      if (!isFollowUpDue(profile, now)) continue;
      const discordId = String(profile.discordId || "").trim();
      if (!discordId) continue;
      try {
        const [member, connected] = await Promise.all([
          strava.hasClubMemberRole(discordId),
          strava.isStravaConnected(discordId),
        ]);
        if (!member || !connected) continue;
      } catch (err) {
        console.warn("coach follow-up eligibility failed:", discordId, err?.message || err);
        continue;
      }
      due.push(profile);
      if (due.length >= MAX_FOLLOW_UPS_PER_RUN) break;
    }
  } catch (err) {
    console.error("listCoachProfiles failed:", err?.message || err);
    return { skipped: "list_failed" };
  }

  let sent = 0;
  for (const profile of due) {
    try {
      await sendOneFollowUp(profile);
      sent += 1;
    } catch (err) {
      console.error("coach follow-up failed:", profile?.discordId, err?.message || err);
      try {
        await markCoachFollowUpSent(profile.discordId);
      } catch {
        /* ignore */
      }
    }
  }

  await setBotState(FOLLOW_UP_STATE_KEY, {
    lastRunDate: todayKey,
    sent,
    considered: due.length,
    updatedAt: now.toISOString(),
  });
  console.log(`🚴 Coach follow-ups: ${sent}/${due.length} on ${todayKey}`);
  return { sent, considered: due.length };
}

module.exports = {
  FOLLOW_UP_TZ,
  FOLLOW_UP_HOUR,
  isFollowUpDue,
  maybeSendCoachFollowUps,
};
