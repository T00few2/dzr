const { getWelcomeMessage, processMessageContent } = require("../services/contentApi");
const config = require("../config/config");
const shared = require("../constants.json");
const { getOnboardingStatus, getClubRoleId } = require("../services/onboardingStatus");
const { buildMessage, loadOnboardingTexts, STEP_KEYS, DM_HINTS, COLLECTION } = require("../services/onboardingDm");
const { getMembershipFacts, feeText, getTeamsLookingForRiders } = require("../services/clubFacts");

const ROLES = shared.discord.roles;

/** Which role's public one-liner goes with each preview status. */
const PUBLIC_LINE_ROLE = {
  fresh_unpaid: () => ROLES.communityMember,
  paid_no_zwift: () => getClubRoleId(),
  verified_not_paid: () => ROLES.verifiedMember,
  paid_role_pending: () => ROLES.verifiedMember,
  club_no_intervals: () => getClubRoleId(),
};

function isAdmin(interaction) {
  return interaction.member?.permissions?.has("Administrator");
}

function previewVariables(interaction, roleId) {
  const user = interaction.user;
  const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
  return {
    username: user.username,
    displayName: interaction.member?.displayName || user.username,
    server_name: interaction.guild.name,
    member_count: interaction.guild.memberCount,
    mention: `<@${user.id}>`,
    role_name: role?.name || "",
    role_mention: roleId ? `<@&${roleId}>` : "",
    role_color: role?.hexColor || "#000000",
    // As if the DM was just sent.
    dm_hint: roleId ? DM_HINTS.role : DM_HINTS.join,
  };
}

async function publicLine(interaction, preset) {
  if (preset === "join") {
    const welcome = await getWelcomeMessage();
    return welcome ? processMessageContent(welcome.content, previewVariables(interaction)) : null;
  }
  const roleId = await PUBLIC_LINE_ROLE[preset]?.();
  if (!roleId) return null;
  const response = await fetch(`${config.contentApi.baseUrl}/api/messages/role-messages`, {
    headers: { Authorization: `Bearer ${config.contentApi.apiKey}` },
  });
  if (!response.ok) return null;
  const messages = (await response.json()).filter((msg) => msg.active && msg.role_id === roleId);
  return messages.map((msg) => processMessageContent(msg.content, previewVariables(interaction, roleId))).join("\n\n") || null;
}

/**
 * /onboarding_preview: send yourself the DM a member in the given status would get, and show the
 * public line. Uses the real templates and live fees/teams, and writes nothing.
 */
async function handleOnboardingPreview(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.editReply({ content: "❌ This command is for administrators only." });
    return;
  }
  const preset = interaction.options.getString("as_status");
  try {
    let keys;
    let status = null;
    if (preset === "join") {
      keys = ["join"];
    } else {
      status = await getOnboardingStatus(null, interaction.user.id, { preset });
      keys = STEP_KEYS.has(status.nextStep) ? [status.nextStep] : [];
      if (preset === "fresh_unpaid") keys.unshift("intro");
    }

    const line = await publicLine(interaction, preset).catch(() => null);
    const publicText = line ? `**Offentlig linje:**\n${line}` : "_Ingen offentlig linje konfigureret._";

    if (!keys.length) {
      await interaction.editReply({ content: `Status \`${preset}\` (${status?.nextStep ?? "ingen"}): Ingen DM sendes i denne status.\n\n${publicText}` });
      return;
    }

    const extras = { name: interaction.member?.displayName || interaction.user.username };
    if (keys.includes("become_club_member")) extras.fee = feeText(await getMembershipFacts());
    if (keys.includes("connect_intervals")) extras.teams = await getTeamsLookingForRiders();
    const content = buildMessage(keys, status, extras, await loadOnboardingTexts(require("../services/firebase").db));

    try {
      await interaction.user.send({ content });
    } catch (error) {
      await interaction.editReply({ content: `⚠️ Kunne ikke sende DM (${error.message}). Åbn for DMs fra servermedlemmer.\n\n${publicText}` });
      return;
    }
    await interaction.editReply({ content: `✅ DM sendt for status \`${preset}\` (${keys.join(" + ")}). Intet er gemt.\n\n${publicText}` });
  } catch (error) {
    console.error("❌ onboarding_preview Error:", error);
    await interaction.editReply({ content: "⚠️ Preview failed: " + error.message });
  }
}

/**
 * /onboarding_reset: forget which onboarding DMs a user got, so the flow can be replayed (alt
 * account testing). The user is marked test so statistics leave them out.
 */
async function handleOnboardingReset(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.editReply({ content: "❌ This command is for administrators only." });
    return;
  }
  const target = interaction.options.getUser("user");
  try {
    const { db } = require("../services/firebase");
    await db.collection(COLLECTION).doc(target.id).set({ test: true, resetAt: new Date() });
    await interaction.editReply({ content: `✅ Onboarding nulstillet for <@${target.id}> og markeret som test.` });
  } catch (error) {
    console.error("❌ onboarding_reset Error:", error);
    await interaction.editReply({ content: "⚠️ Reset failed: " + error.message });
  }
}

module.exports = { handleOnboardingPreview, handleOnboardingReset };
