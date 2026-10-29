/**
 * Personal DM reminders for members stuck on a step, sent when they are likely to see them.
 *
 * Any server activity (message, reaction, voice) schedules a look at that member 10-60 minutes
 * later, at most once per recheckHours. At that time the member must still be active; then their
 * onboarding status decides the step, and the shared DM record decides whether a reminder is due.
 * The DM never mentions their activity.
 *
 * The record is onboarding_dms/{discordId}, shared with the onboarding DMs:
 *   reminders.<step> = { count, lastAt, snoozedAt?, clickedAt?, dmFailedAt? }
 *   lastBotDmAt      the newest DM from the bot of any kind (onboarding, reminder, admin outreach)
 *   companionJoinedAt funnel: first seen in the Companion club after a join_companion reminder
 * Claiming a reminder (count + 1, lastAt, lastBotDmAt, daily counter) happens in one transaction
 * before the send, so two instances cannot both send it; a failed send costs that reminder.
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const shared = require("../../constants.json");
const { DEFAULTS, loadSettings } = require("./settings");
const { localParts, toMs, DAY_MS } = require("./pacing");
const { sendsOf } = require("./dmStats");
const { FEATURES } = require("./features");

const COLLECTION = shared.firestore.onboardingDms || "onboarding_dms";
const DAILY_STATE = "dm_reminders_daily";
const PREFIX = "annrem:";
const DM_CLOSED = 50007;

/** Steps a reminder may be sent for, in the order they are checked. */
const REMINDER_STEPS = ["link_zwift_id_channel", "link_zwift_id_join", "connect_intervals", "join_companion"];

const lastActivity = new Map();
const lastLooked = new Map();
const due = new Map();
let settingsSnapshot = DEFAULTS;

/** The step to remind about, or null. inCompanion: true, false, or null when unknown. */
function reminderStep(status, inCompanion) {
  if (!status?.inServer) return null;
  if (["link_zwift_id_channel", "link_zwift_id_join", "connect_intervals"].includes(status.nextStep)) return status.nextStep;
  if (status.verified && status.zwiftId && inCompanion === false) return "join_companion";
  return null;
}

/** Whether a reminder for step may be sent to the member with this record. */
function decideReminder(doc, step, nowMs, cfg) {
  if (doc?.test) return { ok: false, reason: "test" };
  const entry = doc?.reminders?.[step] || {};
  if (entry.snoozedAt) return { ok: false, reason: "snoozed" };
  if ((entry.count || 0) >= cfg.maxPerStep) return { ok: false, reason: "max_per_step" };
  if (Object.values(doc?.steps || {}).some((row) => row?.dmFailedAt) || Object.values(doc?.reminders || {}).some((row) => row?.dmFailedAt)) {
    return { ok: false, reason: "dms_closed" };
  }
  const lastDm = Math.max(toMs(doc?.lastBotDmAt) || 0, ...sendsOf(doc).map((send) => send.at));
  if (nowMs - lastDm < cfg.minDaysSinceLastDm * DAY_MS) return { ok: false, reason: "recent_dm" };
  const lastReminder = Math.max(0, ...Object.values(doc?.reminders || {}).map((row) => toMs(row?.lastAt) || 0));
  if (nowMs - lastReminder < cfg.perMemberDays * DAY_MS) return { ok: false, reason: "recent_reminder" };
  return { ok: true };
}

function stepBody(step) {
  const { LINKS } = require("../onboardingStatus");
  const channels = shared.discord.channels;
  switch (step) {
    case "link_zwift_id_channel":
      return [
        "**Du mangler stadig at linke dit Zwift ID** → så bliver du ✅ Verificeret Medlem og får adgang til members-zone på hjemmesiden og bot-kommandoerne.",
        `Skriv \`zwiftid 1234567\` (dit eget ID) i <#${channels.zwiftId}>, brug \`/my_zwiftid\` – eller send det bare til mig her.`,
        "Kender du ikke dit ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
      ].join("\n");
    case "link_zwift_id_join":
      return [
        "**Du mangler stadig at linke dit Zwift ID**",
        `Gør det her: ${LINKS.joinZwiftId} – så er du både ⭐ Klub Medlem og ✅ Verificeret Medlem.`,
        "Kender du ikke dit Zwift ID? Skriv dit navn, som det står på Zwift/ZwiftPower, til mig her – så finder jeg dig.",
      ].join("\n");
    case "connect_intervals":
      return [
        "**Har du prøvet DZR Coach?**",
        "Som ⭐ Klub Medlem kan du bruge DZR Coach – en træningscoach her på Discord, der kender dine data og svarer på spørgsmål om din træning.",
        "Skriv `/coach` på serveren, så får du et link til at forbinde din intervals.icu-konto.",
      ].join("\n");
    case "join_companion": {
      const companion = FEATURES.find((feature) => feature.key === "companion_club");
      return `**Er du med i DZR-klubben i Zwift Companion?**\n${companion.pitch}\n${companion.howTo}`;
    }
    default:
      return null;
  }
}

function reminderText(step) {
  const body = stepBody(step);
  if (!body) return null;
  return [
    "👋 Lille påmindelse fra DZR-botten",
    body,
    "Har du spørgsmål, så skriv til mig her – jeg hjælper gerne. _(You can write to me in English.)_",
  ].join("\n\n");
}

function reminderButtons(step) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}done:${step}`).setStyle(ButtonStyle.Success).setLabel("Tak, det kigger jeg på").setEmoji("👍"),
    new ButtonBuilder().setCustomId(`${PREFIX}stop:${step}`).setStyle(ButtonStyle.Secondary).setLabel("Ikke nu").setEmoji("🔕"),
  )];
}

/** Server activity by a member. Cheap: memory only. */
function noteActivity(userId, nowMs = Date.now(), random = Math.random) {
  const id = String(userId);
  lastActivity.set(id, nowMs);
  const cfg = settingsSnapshot.dmReminders;
  if (!settingsSnapshot.enabled || !cfg.enabled || due.has(id)) return;
  if (nowMs - (lastLooked.get(id) || 0) < cfg.recheckHours * 60 * 60 * 1000) return;
  lastLooked.set(id, nowMs);
  const delayMin = cfg.delayMinMinutes + random() * (cfg.delayMaxMinutes - cfg.delayMinMinutes);
  due.set(id, nowMs + delayMin * 60 * 1000);
  // Bound memory on a busy server: forget looks older than the recheck window.
  if (lastLooked.size > 5000) {
    for (const [key, at] of lastLooked) if (nowMs - at > cfg.recheckHours * 60 * 60 * 1000) lastLooked.delete(key);
  }
}

/** Members whose look is due and who are still active: [{ id }]. Removes them from the schedule. */
function takeDue(nowMs, cfg) {
  const ready = [];
  for (const [id, at] of due) {
    if (at > nowMs) continue;
    due.delete(id);
    if (nowMs - (lastActivity.get(id) || 0) <= cfg.activeWithinMinutes * 60 * 1000) ready.push(id);
  }
  return ready;
}

function defaultDeps(client) {
  const { getOnboardingStatus } = require("../onboardingStatus");
  const { listCompanionIds } = require("./sources");
  const db = require("../firebase").db;
  return {
    db,
    now: () => new Date(),
    getStatus: (id) => getOnboardingStatus(client, id),
    inCompanion: async (zwiftId) => {
      const ids = await listCompanionIds(db);
      return ids.size ? ids.has(String(zwiftId)) : null;
    },
    fetchUser: (id) => client.users.fetch(id),
  };
}

/** Transaction: re-check and claim. Returns true when this instance may send. */
async function claimReminder(db, id, step, now, settings) {
  const ref = db.collection(COLLECTION).doc(id);
  const dailyRef = db.collection("bot_state").doc(DAILY_STATE);
  const today = localParts(now, settings.tz).dateKey;
  return db.runTransaction(async (tx) => {
    const [snap, dailySnap] = [await tx.get(ref), await tx.get(dailyRef)];
    const doc = (snap.exists && snap.data()) || {};
    const daily = (dailySnap.exists && dailySnap.data()) || {};
    const sentToday = daily.dateKey === today ? daily.count || 0 : 0;
    if (sentToday >= settings.dmReminders.dailyCap) return false;
    if (!decideReminder(doc, step, now.getTime(), settings.dmReminders).ok) return false;
    const entry = doc.reminders?.[step] || {};
    tx.set(ref, {
      reminders: { [step]: { count: (entry.count || 0) + 1, lastAt: now } },
      lastBotDmAt: now,
    }, { merge: true });
    tx.set(dailyRef, { dateKey: today, count: sentToday + 1 }, { merge: true });
    return true;
  });
}

/** Look at one member and send a reminder if one is due. Returns the outcome, for logs and tests. */
async function maybeRemind(id, { deps, settings }) {
  const status = await deps.getStatus(id);
  if (!status?.inServer) return "not_in_server";
  const inCompanion = status.verified && status.zwiftId ? await deps.inCompanion(status.zwiftId) : null;
  const ref = deps.db.collection(COLLECTION).doc(id);
  if (inCompanion === true) {
    // Funnel: count the Companion join once, and only for members we reminded.
    const snap = await ref.get();
    const doc = (snap.exists && snap.data()) || {};
    if (doc.reminders?.join_companion && !doc.companionJoinedAt) await ref.set({ companionJoinedAt: deps.now() }, { merge: true });
  }
  const step = reminderStep(status, inCompanion);
  if (!step) return "nothing_due";
  const now = deps.now();
  if (!(await claimReminder(deps.db, id, step, now, settings))) return "not_due";
  try {
    const user = await deps.fetchUser(id);
    await user.send({ content: reminderText(step), components: reminderButtons(step) });
    return `sent:${step}`;
  } catch (error) {
    if (error?.code === DM_CLOSED) {
      await ref.set({ reminders: { [step]: { dmFailedAt: now } } }, { merge: true });
      return "dm_closed";
    }
    console.warn(`DM reminder to ${id} failed:`, error?.message || error);
    return "error";
  }
}

/** Minute tick: look at members whose delay has passed. */
async function processDue(client, { deps } = {}) {
  const d = deps || defaultDeps(client);
  const settings = await loadSettings(d.db);
  settingsSnapshot = settings;
  if (!settings.enabled || !settings.dmReminders.enabled) {
    due.clear();
    return [];
  }
  const ready = takeDue(d.now().getTime(), settings.dmReminders);
  if (!ready.length) return [];
  // /announcer_pause pauses reminders too.
  const stateSnap = await d.db.collection("bot_state").doc("announcer").get();
  if (stateSnap.exists && stateSnap.data()?.paused) return [];
  const outcomes = [];
  for (const id of ready) {
    try {
      const outcome = await maybeRemind(id, { deps: d, settings });
      outcomes.push({ id, outcome });
      if (outcome.startsWith("sent")) console.log(`🔔 DM reminder ${outcome} to ${id}`);
    } catch (error) {
      console.warn(`DM reminder check for ${id} failed:`, error?.message || error);
    }
  }
  return outcomes;
}

/** The 👍 / 🔕 buttons on a reminder DM. */
async function handleReminderInteraction(interaction, deps) {
  const db = deps?.db || require("../firebase").db;
  const [, action, step] = interaction.customId.split(":");
  const field = action === "stop" ? "snoozedAt" : "clickedAt";
  await db.collection(COLLECTION).doc(String(interaction.user.id)).set({ reminders: { [step]: { [field]: new Date() } } }, { merge: true });
  const reply = action === "stop"
    ? "Forstået 🔕 Jeg minder dig ikke om det her igen. Skriv til mig, hvis du får brug for hjælp."
    : "Super 👍 Skriv til mig her, hvis du går i stå undervejs.";
  await interaction.update({ components: [] });
  await interaction.followUp({ content: reply });
}

function isReminderInteraction(interaction) {
  return interaction.isButton() && interaction.customId.startsWith(PREFIX);
}

/** For tests: forget the in-memory schedule. */
function resetSchedule() {
  lastActivity.clear();
  lastLooked.clear();
  due.clear();
}

module.exports = {
  REMINDER_STEPS,
  reminderStep,
  decideReminder,
  reminderText,
  noteActivity,
  takeDue,
  maybeRemind,
  processDue,
  claimReminder,
  handleReminderInteraction,
  isReminderInteraction,
  resetSchedule,
  COLLECTION,
};
