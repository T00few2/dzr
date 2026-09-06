const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { addCoachChatNotes, listCoachChatNotes } = require("./firebase");
const { activeGoalNotes, MAX_ACTIVE_GOALS, sanitizeEventDate } = require("./coachChatNotes");

const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingGoals = new Map();

function pendingKey(discordId) {
  return String(discordId || "").trim();
}

function clearPending(discordId) {
  const key = pendingKey(discordId);
  const existing = pendingGoals.get(key);
  if (existing?.timeout) clearTimeout(existing.timeout);
  pendingGoals.delete(key);
}

function storePending(discordId, payload) {
  const key = pendingKey(discordId);
  clearPending(key);
  const timeout = setTimeout(() => pendingGoals.delete(key), PENDING_TTL_MS);
  pendingGoals.set(key, { ...payload, timeout });
}

function goalButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("coach_goal_yes").setLabel("Ja").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("coach_goal_no").setLabel("Nej").setStyle(ButtonStyle.Secondary)
  );
}

async function proposeCoachGoal({ discordId, channel, text, eventDate, replaceNoteId, language }) {
  const id = pendingKey(discordId);
  const date = sanitizeEventDate(eventDate);
  const clipped = String(text || "").trim().slice(0, 280);
  if (!id || !clipped || !date) {
    return { success: false, message: "text and a future eventDate (YYYY-MM-DD) are required." };
  }

  const notes = await listCoachChatNotes(id);
  const active = activeGoalNotes(notes);
  const replaceId = String(replaceNoteId || "").trim();
  if (active.length >= MAX_ACTIVE_GOALS && !active.some((note) => note.id === replaceId)) {
    return {
      success: false,
      reason: "goal_cap",
      goals: active.map((note) => ({ id: note.id, text: note.text, eventDate: note.eventDate })),
      message: `Already ${MAX_ACTIVE_GOALS} active goals. Ask which to replace and call again with replaceNoteId.`,
    };
  }

  const da = language === "en"
    ? `Save this as a goal?\n**${clipped}**\nDate: **${date}**\n\nI only remember it if you press Ja.`
    : `Skal jeg gemme dette som mål?\n**${clipped}**\nDato: **${date}**\n\nJeg husker det først, når du trykker Ja.`;

  storePending(id, { text: clipped, eventDate: date, replaceNoteId: replaceId || null });
  await channel.send({
    content: da,
    components: [goalButtons()],
    flags: MessageFlags.SuppressEmbeds,
  });
  return {
    success: true,
    proposed: true,
    text: clipped,
    eventDate: date,
    message: "Confirmation buttons sent. Do not say the goal is saved until they press Ja.",
  };
}

async function handleCoachGoalButton(interaction) {
  if (!interaction?.isButton?.()) return false;
  const customId = String(interaction.customId || "");
  if (customId !== "coach_goal_yes" && customId !== "coach_goal_no") return false;

  const discordId = interaction.user?.id;
  if (!discordId) return true;

  const pending = pendingGoals.get(pendingKey(discordId));
  if (!pending) {
    await interaction.reply({
      content: "Det forslag er udløbet. Skriv målet igen, så spørger jeg på ny.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => undefined);
    return true;
  }

  if (customId === "coach_goal_no") {
    clearPending(discordId);
    await interaction.update({
      content: "Okay — jeg gemte ikke målet.",
      components: [],
    }).catch(() => undefined);
    return true;
  }

  const result = await addCoachChatNotes(discordId, [{
    text: pending.text,
    kind: "goal",
    eventDate: pending.eventDate,
  }], { allowGoals: true, replaceNoteId: pending.replaceNoteId });
  clearPending(discordId);
  const saved = Array.isArray(result?.saved) ? result.saved : [];
  const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
  const failed = !saved.length;
  const reason = skipped[0]?.reason;
  const content = failed
    ? (reason === "goal_cap"
      ? "Du har allerede 3 aktive mål. Slet et under Mine sider, eller sig hvilket jeg skal erstatte."
      : "Jeg kunne ikke gemme målet. Prøv igen, eller skriv det under Mine sider → Coach.")
    : `Målet er gemt: **${pending.text}** (${pending.eventDate}).`;
  await interaction.update({ content, components: [] }).catch(() => undefined);
  return true;
}

function isCoachGoalButton(customId) {
  return customId === "coach_goal_yes" || customId === "coach_goal_no";
}

module.exports = {
  proposeCoachGoal,
  handleCoachGoalButton,
  isCoachGoalButton,
};
