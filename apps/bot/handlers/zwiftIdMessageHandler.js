const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require("discord.js");
const { linkUserZwiftId, getUserZwiftId } = require("../services/firebase");
const { lookupRiderIdentity } = require("../services/riderIdentity");
const { checkVerificationAfterZwiftLink } = require("./memberHandler");
const shared = require("../constants.json");

const ZWIFT_ID_CHANNEL = shared.discord.channels.zwiftId;
const INVALID_FORM_BODY = 50035;

/**
 * Detect if a message contains a Zwift ID in various formats
 * Patterns: "ZwiftID : 123456", "zwiftid 123456", "zwift id: 123456", etc.
 * @param {string} content - The message content
 * @returns {string|null} - The extracted Zwift ID or null
 */
function detectZwiftIdPattern(content) {
  // Pattern: zwift (optional space) id (optional colon/space) <number>
  // Case insensitive, flexible whitespace
  const patterns = [
    /zwift\s*id\s*[:-]?\s*(\d{5,})/i,  // "zwiftid: 123456", "zwift id 123456"
    /zwift\s*[:-]?\s*(\d{5,})/i,        // "zwift: 123456", "zwift 123456"
    /zid\s*[:-]?\s*(\d{5,})/i,          // "zid: 123456", "zid 123456"
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1]; // Return the captured group (the ID)
    }
  }

  return null;
}

function riderFields(identity) {
  const fields = [];
  const { zwift, zp } = identity;
  if (zwift) {
    const country = zwift.country ? ` (${zwift.country})` : "";
    const score = zwift.racingScore != null ? `\nZRS ${Math.round(zwift.racingScore)}${zwift.category ? ` · kategori ${zwift.category}` : ""}` : "";
    fields.push({ name: "🚴 Zwift", value: `**${zwift.name}**${country}${score}`, inline: true });
  }
  if (zp) {
    const lines = [zp.name && !zwift ? `**${zp.name}**` : null, zp.category ? `Kategori ${zp.category}` : null, zp.team ? `Hold: ${zp.team}` : null]
      .filter(Boolean);
    if (zp.lastRace) lines.push(`Seneste løb: ${zp.lastRace.title}${zp.lastRace.date ? ` (${zp.lastRace.date})` : ""}`);
    fields.push({ name: "📊 ZwiftPower", value: `${lines.join("\n") || "Profil fundet"}\n[Se profil](${identity.zpUrl})`, inline: true });
  }
  return fields;
}

/**
 * The confirm message for linking a Zwift ID, shared by the Zwift ID channel, /my_zwiftid and the
 * club assistant. identity comes from lookupRiderIdentity: a rider card, notFound, or error (the
 * plain number-only confirm, so linking never breaks when the lookup does).
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function buildZwiftIdConfirmation(userId, zwiftId, identity, existingZwiftId = null) {
  const embed = new EmbedBuilder().setTimestamp();
  const confirm = new ButtonBuilder()
    .setCustomId(`confirm_zwiftid_${userId}_${zwiftId}`)
    .setLabel("✅ Ja, det er mig")
    .setStyle(ButtonStyle.Success);
  const cancel = new ButtonBuilder()
    .setCustomId(`cancel_zwiftid_${userId}`)
    .setLabel("❌ Annuller")
    .setStyle(ButtonStyle.Danger);
  const update = existingZwiftId && existingZwiftId !== zwiftId
    ? `Du er ved at **ændre** dit linkede Zwift ID fra **${existingZwiftId}** til **${zwiftId}**.`
    : null;

  if (identity?.notFound) {
    embed
      .setColor(0xFF9900)
      .setTitle("🔎 Ingen Zwift-profil fundet")
      .setDescription([
        `Jeg kan ikke finde en Zwift-profil med ID **${zwiftId}** – tjek tallet.`,
        "Kender du ikke dit ID? `/my_zwiftid searchterm:` finder dig på dit Zwift-navn.",
        update,
      ].filter(Boolean).join("\n\n"));
    // Same confirm_zwiftid_ prefix: bot.js only routes confirm_zwiftid_ and cancel_zwiftid_.
    confirm.setLabel("Link alligevel").setStyle(ButtonStyle.Secondary);
  } else if (identity?.zwift || identity?.zp) {
    embed
      .setColor(existingZwiftId ? 0xFF9900 : 0x00AA55)
      .setTitle("🔗 Er det dig?")
      .setDescription([`Zwift ID **${zwiftId}**`, update].filter(Boolean).join("\n\n"))
      .addFields(riderFields(identity));
    if (identity.zwift?.avatar) embed.setThumbnail(identity.zwift.avatar);
  } else {
    embed
      .setColor(existingZwiftId ? 0xFF9900 : 0x00FF00)
      .setTitle("🔗 Zwift ID Confirmation")
      .setDescription(update || `You're about to link Zwift ID **${zwiftId}** to your Discord account`)
      .addFields([{ name: "🚴 Zwift ID", value: zwiftId, inline: true }])
      .setFooter({ text: "Please confirm this is correct" });
  }

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(confirm, cancel)] };
}

/** Send a confirm payload; if Discord rejects the avatar URL, send it again without the thumbnail. */
async function sendConfirmation(send, payload) {
  try {
    return await send(payload);
  } catch (error) {
    const embed = payload.embeds?.[0];
    if (error?.code !== INVALID_FORM_BODY || !embed?.data?.thumbnail) throw error;
    embed.setThumbnail(null);
    return send(payload);
  }
}

/** Look up the rider and build the confirm message for this user. */
async function prepareZwiftIdConfirmation(userId, zwiftId) {
  const [identity, existing] = await Promise.all([
    lookupRiderIdentity(zwiftId).catch(() => ({ error: true })),
    getUserZwiftId(userId),
  ]);
  return buildZwiftIdConfirmation(userId, zwiftId, identity, existing);
}

/**
 * Handle messages that might contain a Zwift ID
 * @param {Message} message - Discord message object
 */
async function handleZwiftIdMessage(message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only process messages in the specific channel
  if (message.channel.id !== ZWIFT_ID_CHANNEL) return;

  const zwiftId = detectZwiftIdPattern(message.content);

  // If no Zwift ID pattern detected, return early
  if (!zwiftId) return;

  try {
    const payload = await prepareZwiftIdConfirmation(message.author.id, zwiftId);
    await sendConfirmation((p) => message.reply(p), payload);
  } catch (error) {
    console.error("Error handling Zwift ID message:", error);
    try {
      await message.reply(
        "⚠️ Der opstod en fejl, da jeg forsøgte at linke dit ZwiftID.\n\n" +
        "Prøv igen ved at sende dit ZwiftID (kun tal) eller de første 3+ bogstaver i dit Zwift-navn."
      );
    } catch (replyError) {
      // Ignore if we can't reply
    }
  }
}

function resultEmbed(title, description, color, footer) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

/**
 * Handle button interactions for Zwift ID confirmation.
 * deferUpdate + editReply edits the message holding the buttons whether it is a channel message,
 * an ephemeral slash-command reply or a DM.
 * @param {ButtonInteraction} interaction - Discord button interaction
 */
async function handleZwiftIdConfirmation(interaction) {
  const customId = interaction.customId;

  // Handle confirmation
  if (customId.startsWith("confirm_zwiftid_")) {
    const parts = customId.split("_");
    const userId = parts[2];
    const zwiftId = parts[3];

    // Verify the interaction is from the correct user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You cannot confirm someone else's Zwift ID linking.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await interaction.deferUpdate();

      // Link the Zwift ID
      await linkUserZwiftId(userId, interaction.user.username, zwiftId);

      await interaction.editReply({
        embeds: [resultEmbed(
          "✅ Zwift ID linket",
          `Zwift ID **${zwiftId}** er nu linket til din Discord-konto.`,
          0x00FF00,
          "Du kan altid ændre det ved at sende et nyt ID"
        )],
        components: []
      });

      await interaction.followUp({
        content: "✅ Dit Zwift ID er linket! Du kan nu bruge kommandoer som `/whoami` og `/rider_stats`.",
        flags: MessageFlags.Ephemeral
      });

      // Check verification status after linking. A DM has no guild, so use the DZR server.
      const guild = interaction.guild || interaction.client.guilds.cache.get(shared.discord.guildId);
      if (guild) {
        await checkVerificationAfterZwiftLink(guild, userId);
      }

    } catch (error) {
      console.error("Error confirming Zwift ID:", error);
      await interaction.followUp({
        content:
          "⚠️ Der opstod en fejl, da jeg forsøgte at linke dit ZwiftID.\n\n" +
          "Prøv igen ved at sende dit ZwiftID (kun tal) eller de første 3+ bogstaver i dit Zwift-navn.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }

  // Handle cancellation
  if (customId.startsWith("cancel_zwiftid_")) {
    const parts = customId.split("_");
    const userId = parts[2];

    // Verify the interaction is from the correct user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You cannot cancel someone else's Zwift ID linking.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await interaction.deferUpdate();
      await interaction.editReply({
        embeds: [resultEmbed("❌ Annulleret", "Zwift ID blev ikke linket.", 0x808080, "Send et nyt ID for at prøve igen")],
        components: []
      });
    } catch (error) {
      console.error("Error cancelling Zwift ID:", error);
    }
  }
}

module.exports = {
  handleZwiftIdMessage,
  handleZwiftIdConfirmation,
  buildZwiftIdConfirmation,
  prepareZwiftIdConfirmation,
  sendConfirmation,
  detectZwiftIdPattern // Export for testing
};
