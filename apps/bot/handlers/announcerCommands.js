const shared = require("../constants.json");
const { runDaily, setPaused, readState } = require("../services/announcer");
const { loadSettings } = require("../services/announcer/settings");
const { funnel } = require("../services/announcer/dmStats");
const { reminderText } = require("../services/announcer/dmReminders");
const { listOpenDrafts } = require("../services/announcer/drafts");
const { toMs } = require("../services/announcer/pacing");

const STEP_LABELS = {
  link_zwift_id_channel: "Link Zwift ID",
  link_zwift_id_join: "Link Zwift ID (/join)",
  meet_verification: "Verificering",
  become_club_member: "Bliv klubmedlem",
  club_role_pending: "Klubrolle afventer",
  connect_intervals: "DZR Coach",
  join_companion: "Companion-klub",
  intro: "Intro",
  join: "Velkomst",
};

function isAdmin(interaction) {
  return interaction.member?.permissions?.has("Administrator");
}

async function adminOnly(interaction) {
  if (isAdmin(interaction)) return true;
  await interaction.editReply({ content: "❌ This command is for administrators only." });
  return false;
}

function when(value) {
  const ms = toMs(value);
  return ms ? `<t:${Math.floor(ms / 1000)}:R>` : "aldrig";
}

/** /announcer_run: the candidates in pick order, and optionally a draft of the first one now. */
async function handleAnnouncerRun(interaction) {
  if (!(await adminOnly(interaction))) return;
  const draft = interaction.options.getBoolean("draft") || false;
  try {
    const result = await runDaily(interaction.client, { dryRun: !draft });
    const rankedKeys = new Set(result.ranked.map((candidate) => candidate.key));
    const lines = [
      ...result.ranked.map((candidate, index) => `${index + 1}. **${candidate.key}** (prioritet ${candidate.priority}) – ${candidate.reason}`),
      ...result.candidates.filter((candidate) => !rankedKeys.has(candidate.key)).map((candidate) => `• ~~${candidate.key}~~ – pause, åbent udkast eller samme slags som sidst`),
    ];
    const head = draft
      ? (result.draftId ? `✅ Udkast lagt i <#${shared.discord.channels.moderators}> om **${result.picked.key}**.` : `Intet udkast (${result.skipped}).`)
      : "Tørløb – intet er skrevet. Brug `draft:true` for at lave et udkast nu.";
    await interaction.editReply({ content: [head, `Åbne udkast: ${result.open}`, "", ...(lines.length ? lines : ["Ingen emner lige nu."])].join("\n").slice(0, 1900) });
  } catch (error) {
    console.error("❌ announcer_run Error:", error);
    await interaction.editReply({ content: "⚠️ Announcer run failed: " + error.message });
  }
}

async function handleAnnouncerPause(interaction) {
  if (!(await adminOnly(interaction))) return;
  const paused = interaction.options.getBoolean("paused");
  await setPaused(paused);
  await interaction.editReply({ content: paused ? "⏸️ Bot-opslag og DM-påmindelser er sat på pause." : "▶️ Bot-opslag og DM-påmindelser kører igen." });
}

/** /announcer_stats: the DM funnel per step and the announcer's recent posts. */
async function handleAnnouncerStats(interaction) {
  if (!(await adminOnly(interaction))) return;
  try {
    const { db } = require("../services/firebase");
    const settings = await loadSettings(db);
    const snap = await db.collection(shared.firestore.onboardingDms).get();
    const rows = funnel(snap.docs.map((doc) => doc.data()), new Date(), settings.signals.dmUnseen.silentDays);
    const state = await readState(db);
    const open = await listOpenDrafts(db);

    const table = Object.entries(rows)
      .sort((a, b) => b[1].sent - a[1].sent)
      .map(([step, row]) => `**${STEP_LABELS[step] || step}**: sendt ${row.sent} · lukkede DMs ${row.failed} · reageret ${row.engaged} · gennemført ${row.converted} · tavse ${row.silent}`);
    const recent = (state.published || []).slice(-5).reverse().map((row) => `• ${row.kind} ${when(row.at)} i <#${row.channelId}>`);
    await interaction.editReply({
      content: [
        "**Botten DMs** (reageret = svaret eller trykket på en knap; tavse = leveret for mindst " +
          `${settings.signals.dmUnseen.silentDays} dage siden uden nogen reaktion – en øvre grænse for "ikke set")`,
        ...(table.length ? table : ["Ingen DMs registreret endnu."]),
        "",
        `**Opslag** ${state.paused ? "(⏸️ pause)" : ""} – åbne udkast: ${open.length}`,
        ...(recent.length ? recent : ["Ingen bot-opslag endnu."]),
      ].join("\n").slice(0, 1900),
    });
  } catch (error) {
    console.error("❌ announcer_stats Error:", error);
    await interaction.editReply({ content: "⚠️ Stats failed: " + error.message });
  }
}

async function handleAnnouncerPreviewDm(interaction) {
  if (!(await adminOnly(interaction))) return;
  const step = interaction.options.getString("step");
  try {
    const { db } = require("../services/firebase");
    await interaction.user.send({ content: reminderText(step, await loadSettings(db)) });
    await interaction.editReply({ content: `✅ Påmindelsen for \`${step}\` er sendt til dig som DM (uden knapper). Intet er gemt.` });
  } catch (error) {
    await interaction.editReply({ content: `⚠️ Kunne ikke sende DM (${error.message}).` });
  }
}

module.exports = { handleAnnouncerRun, handleAnnouncerPause, handleAnnouncerStats, handleAnnouncerPreviewDm };
