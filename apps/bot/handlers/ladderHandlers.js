const ladderTeams = require("../services/ladder/ladderTeams");
const ladderClient = require("../services/ladder/ladderClient");
const { buildLadderPreviewMessage } = require("../services/ladder/ladderEmbed");
const { buildLadderAnalysisMessage } = require("../services/ladder/ladderAnalysis");
const config = require("../config/config");

// The team from the option, or the only linked team when the option is left out.
async function resolveTeam(interaction) {
  const input = interaction.options.getString("team");
  if (input) return ladderTeams.parseTeamName(input);
  const teams = await ladderTeams.list();
  return teams.length === 1 ? teams[0].name : null;
}

async function findFixture(interaction, teamName) {
  const fixtureId = interaction.options.getInteger("match");
  const fixture = fixtureId ? await ladderClient.getFixture(fixtureId) : await ladderClient.getNextFixture(teamName);
  return fixture && fixture.start ? ladderClient.refreshFixture(fixture) : null;
}

async function replyError(interaction, name, error) {
  console.error(`❌ ${name} error:`, error);
  await interaction.editReply({ content: error.userMessage || "⚠️ Der skete en fejl." });
}

async function handleLadderLink(interaction) {
  try {
    const teamName = ladderTeams.parseTeamName(interaction.options.getString("team", true));
    if (!teamName) {
      await interaction.editReply({ content: "Angiv et holdnavn eller et ladder-link." });
      return;
    }

    if (interaction.options.getBoolean("remove")) {
      const removed = await ladderTeams.unlink(teamName);
      await interaction.editReply({ content: removed ? `${teamName} får ikke længere preview.` : `${teamName} var ikke tilføjet.` });
      return;
    }

    const minutes = interaction.options.getInteger("minutes");
    if (!(await ladderTeams.link(teamName))) {
      await interaction.editReply({ content: `Der kan højst tilføjes ${ladderTeams.MAX_TEAMS} hold. Fjern et hold først.` });
      return;
    }
    if (minutes) await ladderTeams.setPreviewMinutes(teamName, minutes);
    await interaction.editReply({
      content: `${teamName} får nu preview og løbsdag-besked i <#${config.ladder.channelId}>${minutes ? `, preview ${minutes} minutter før start` : ""}.`,
    });
  } catch (error) {
    await replyError(interaction, "ladder_link", error);
  }
}

async function handleLadderPreview(interaction) {
  try {
    const teamName = await resolveTeam(interaction);
    if (!teamName) {
      await interaction.editReply({ content: "Angiv et hold." });
      return;
    }
    const fixture = await findFixture(interaction, teamName);
    if (!fixture) {
      await interaction.editReply({ content: `Fandt ingen kommende kamp for ${teamName}.` });
      return;
    }
    // Deliberately does not mark the match as posted, so the scheduled preview is unaffected.
    await interaction.channel.send(await buildLadderPreviewMessage(fixture, teamName));
    await interaction.editReply({ content: "✅ Preview postet." });
  } catch (error) {
    await replyError(interaction, "ladder_preview", error);
  }
}

async function handleLadderAnalysis(interaction) {
  try {
    const teamName = await resolveTeam(interaction);
    if (!teamName) {
      await interaction.editReply({ content: "Angiv et hold." });
      return;
    }
    const fixture = await findFixture(interaction, teamName);
    if (!fixture) {
      await interaction.editReply({ content: `Fandt ingen kommende kamp for ${teamName}.` });
      return;
    }
    await interaction.editReply(await buildLadderAnalysisMessage(fixture, teamName));
  } catch (error) {
    await replyError(interaction, "ladder_analysis", error);
  }
}

module.exports = { handleLadderLink, handleLadderPreview, handleLadderAnalysis };
