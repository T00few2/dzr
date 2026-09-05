const { Client, GatewayIntentBits, ActivityType, Partials } = require("discord.js");
const config = require("../config/config");

let coachClient = null;
let coachReady = Promise.resolve(null);

function isCoachBotConfigured() {
  return Boolean(config.discord.coachToken);
}

function getCoachClientSync() {
  return coachClient;
}

async function getCoachClient() {
  if (!coachClient) return null;
  try {
    await coachReady;
  } catch (err) {
    console.warn("DZR Coach login failed:", err?.message || err);
    return null;
  }
  return coachClient;
}

function startCoachBot() {
  if (!config.discord.coachToken) {
    console.warn("⚠️ DZR Coach skipped: COACH_BOT_TOKEN is not set");
    return null;
  }

  const { handleCoachChatMessage } = require("../handlers/aiChatHandler");

  coachClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  coachClient.on("messageCreate", async (message) => {
    try {
      await handleCoachChatMessage(message, coachClient);
    } catch (err) {
      console.error("DZR Coach message handler failed:", err);
    }
  });

  coachClient.once("ready", () => {
    console.log(`✅ DZR Coach logged in as ${coachClient.user.tag}`);
    coachClient.user.setPresence({
      activities: [{ name: "your training", type: ActivityType.Listening }],
      status: "online",
    });
  });

  coachReady = coachClient.login(config.discord.coachToken).catch((err) => {
    console.error("❌ DZR Coach failed to login:", err);
    throw err;
  });

  return coachClient;
}

module.exports = {
  startCoachBot,
  getCoachClient,
  getCoachClientSync,
  isCoachBotConfigured,
};
