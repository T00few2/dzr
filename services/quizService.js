const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { routes, worlds } = require("zwift-data");
const config = require("../config/config");
const { renderRouteSilhouette } = require("../utils/routeMapRenderer");

const CACHE_DIR = path.join(__dirname, "..", "data", "route-latlng");
const QUIZ_TTL_MS = 15 * 60 * 1000; // auto-close after 15 minutes
const GEOMETRY_BASE_URL =
  process.env.QUIZ_GEOMETRY_BASE_URL ||
  "https://andipaetzold.github.io/zwiftquiz/routes";

/** @type {Map<string, object>} quizId -> active quiz */
const activeQuizzes = new Map();
/** channelId -> quizId for one-active-quiz-per-channel */
const channelActiveQuiz = new Map();

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getWorldName(slug) {
  return worlds.find((w) => w.slug === slug)?.name || slug;
}

function getCandidateRoutes() {
  return routes.filter((r) => r.stravaSegmentId && !r.eventOnly);
}

/**
 * Same distractor logic as ZwiftQuiz: prefer same-world, fill with others.
 */
function getAnswers(correctRoute) {
  const answers = [correctRoute];
  const sameWorld = getCandidateRoutes().filter(
    (r) => r.world === correctRoute.world && r.id !== correctRoute.id
  );

  while (answers.length < 3 && sameWorld.length > 0) {
    const pick = randomItem(sameWorld);
    if (!answers.some((a) => a.id === pick.id)) answers.push(pick);
    // avoid infinite loop on tiny worlds
    if (answers.length >= Math.min(3, sameWorld.length + 1)) break;
  }

  const otherWorld = getCandidateRoutes().filter(
    (r) => r.world !== correctRoute.world
  );
  while (answers.length < 4 && otherWorld.length > 0) {
    const pick = randomItem(otherWorld);
    if (!answers.some((a) => a.id === pick.id)) answers.push(pick);
  }

  return shuffle(answers);
}

async function fetchLatLng(stravaSegmentId) {
  ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${stravaSegmentId}.json`);

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (Array.isArray(cached) && cached.length > 10) return cached;
    } catch {
      // fall through to refetch
    }
  }

  const url = `${GEOMETRY_BASE_URL}/${stravaSegmentId}.json`;
  const response = await axios.get(url, {
    timeout: 15000,
    validateStatus: (s) => s === 200,
  });

  const latlng = response.data;
  if (!Array.isArray(latlng) || latlng.length < 10) {
    throw new Error(`Invalid geometry for segment ${stravaSegmentId}`);
  }

  try {
    fs.writeFileSync(cachePath, JSON.stringify(latlng));
  } catch (err) {
    console.warn("Could not cache route geometry:", err.message);
  }

  return latlng;
}

async function pickQuizRoute(maxAttempts = 12) {
  const candidates = getCandidateRoutes();
  if (candidates.length === 0) throw new Error("No quiz routes available");

  const tried = new Set();
  for (let i = 0; i < maxAttempts; i++) {
    const route = randomItem(candidates);
    if (tried.has(route.id)) continue;
    tried.add(route.id);
    try {
      const latlng = await fetchLatLng(route.stravaSegmentId);
      return { route, latlng };
    } catch (err) {
      console.warn(
        `Quiz geometry miss for ${route.name} (${route.stravaSegmentId}):`,
        err.message
      );
    }
  }
  throw new Error("Could not load geometry for a quiz route. Try again later.");
}

function buildQuizEmbed({ answers, imageName, resolved = null, winner = null }) {
  const embed = new EmbedBuilder()
    .setColor(resolved ? 0x2ecc71 : 0xfc6719)
    .setTitle(resolved ? "🏁 Route revealed!" : "🗺️ Zwift Route Quiz")
    .setImage(`attachment://${imageName}`);

  if (resolved) {
    const correct = answers.find((a) => a.correct) || answers[0];
    embed.setDescription(
      `**${correct.name}**\n` +
        `${getWorldName(correct.world)} · ${correct.distance?.toFixed?.(1) ?? "?"} km · ${Math.round(correct.elevation || 0)} m\n\n` +
        (winner
          ? `First correct answer: <@${winner}>`
          : "Time's up — nobody got it this round.")
    );
  } else {
    embed.setDescription(
      "Which Zwift route is this?\nTap a button below. First correct answer wins!"
    );
    embed.setFooter({ text: "Inspired by ZwiftQuiz · Closes in 15 minutes" });
  }

  return embed;
}

function buildAnswerButtons(quizId, answers, disabled = false) {
  const row = new ActionRowBuilder();
  for (let i = 0; i < answers.length; i++) {
    const label = answers[i].name.slice(0, 80);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`quiz_answer_${quizId}_${i}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }
  return [row];
}

function clearQuizTimers(quiz) {
  if (quiz?.timeoutHandle) {
    clearTimeout(quiz.timeoutHandle);
    quiz.timeoutHandle = null;
  }
}

function removeActiveQuiz(quizId) {
  const quiz = activeQuizzes.get(quizId);
  if (!quiz) return;
  clearQuizTimers(quiz);
  activeQuizzes.delete(quizId);
  if (channelActiveQuiz.get(quiz.channelId) === quizId) {
    channelActiveQuiz.delete(quiz.channelId);
  }
}

async function closeQuiz(quizId, { winnerId = null, reason = "timeout" } = {}) {
  const quiz = activeQuizzes.get(quizId);
  if (!quiz || quiz.resolved) return;

  quiz.resolved = true;
  clearQuizTimers(quiz);

  const embed = buildQuizEmbed({
    answers: quiz.answers,
    imageName: quiz.imageName,
    resolved: true,
    winner: winnerId,
  });

  const components = buildAnswerButtons(quizId, quiz.answers, true);

  try {
    const message = quiz.message;
    if (message?.editable) {
      await message.edit({ embeds: [embed], components });
    }
  } catch (err) {
    console.error("Failed to update quiz message on close:", err.message);
  }

  if (reason === "timeout") {
    try {
      await quiz.message?.reply?.(
        "⏱️ Quiz closed — the route was **" +
          quiz.correctRoute.name +
          "** (" +
          getWorldName(quiz.correctRoute.world) +
          ")."
      );
    } catch {
      // ignore
    }
  }

  // Keep briefly so late clicks can get a friendly response, then drop
  setTimeout(() => removeActiveQuiz(quizId), 60_000);
}

/**
 * Post a new quiz to a Discord channel.
 */
async function postQuiz(channel, { requestedBy = null } = {}) {
  if (!channel) throw new Error("Channel is required");

  const existingId = channelActiveQuiz.get(channel.id);
  if (existingId && activeQuizzes.get(existingId) && !activeQuizzes.get(existingId).resolved) {
    return {
      success: false,
      message: "There's already an active quiz in this channel. Finish that one first!",
    };
  }

  const { route, latlng } = await pickQuizRoute();
  const answers = getAnswers(route).map((r) => ({
    id: r.id,
    name: r.name,
    world: r.world,
    distance: r.distance,
    elevation: r.elevation,
    correct: r.id === route.id,
  }));

  const imageBuffer = renderRouteSilhouette(latlng);
  const quizId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const imageName = `quiz_${quizId}.png`;
  const attachment = new AttachmentBuilder(imageBuffer, { name: imageName });

  const embed = buildQuizEmbed({ answers, imageName });
  if (requestedBy) {
    embed.setFooter({
      text: `Requested by ${requestedBy} · Inspired by ZwiftQuiz · Closes in 15 minutes`,
    });
  }

  const components = buildAnswerButtons(quizId, answers, false);

  const message = await channel.send({
    content: requestedBy ? `🧠 Quiz time!` : `🧠 **Daily Zwift Quiz** — name that route!`,
    embeds: [embed],
    files: [attachment],
    components,
  });

  const quiz = {
    id: quizId,
    channelId: channel.id,
    messageId: message.id,
    message,
    correctRoute: route,
    answers,
    imageName,
    resolved: false,
    guesses: new Set(),
    createdAt: Date.now(),
    timeoutHandle: null,
  };

  quiz.timeoutHandle = setTimeout(() => {
    closeQuiz(quizId, { reason: "timeout" }).catch((err) =>
      console.error("Quiz timeout close failed:", err)
    );
  }, QUIZ_TTL_MS);

  activeQuizzes.set(quizId, quiz);
  channelActiveQuiz.set(channel.id, quizId);

  return { success: true, quizId, message };
}

async function handleQuizButton(interaction) {
  if (!interaction.customId?.startsWith("quiz_answer_")) return false;

  // customId: quiz_answer_<quizId>_<index>  (quizId may contain underscores)
  const withoutPrefix = interaction.customId.slice("quiz_answer_".length);
  const lastUnderscore = withoutPrefix.lastIndexOf("_");
  if (lastUnderscore < 0) return true;

  const quizId = withoutPrefix.slice(0, lastUnderscore);
  const index = Number.parseInt(withoutPrefix.slice(lastUnderscore + 1), 10);
  const quiz = activeQuizzes.get(quizId);

  if (!quiz) {
    await interaction.reply({
      content: "This quiz is no longer active.",
      ephemeral: true,
    });
    return true;
  }

  if (quiz.resolved) {
    await interaction.reply({
      content: `Already solved — it was **${quiz.correctRoute.name}**.`,
      ephemeral: true,
    });
    return true;
  }

  const answer = quiz.answers[index];
  if (!answer) {
    await interaction.reply({ content: "Invalid answer.", ephemeral: true });
    return true;
  }

  const userId = interaction.user.id;
  if (quiz.guesses.has(userId)) {
    await interaction.reply({
      content: "You've already guessed on this quiz — one try each!",
      ephemeral: true,
    });
    return true;
  }
  quiz.guesses.add(userId);

  if (answer.correct) {
    await interaction.reply({
      content: `✅ Correct! **${quiz.correctRoute.name}** — nice one, ${interaction.user}!`,
    });
    await closeQuiz(quizId, { winnerId: userId, reason: "solved" });
  } else {
    await interaction.reply({
      content: `❌ Not **${answer.name}**. Someone else might still get it!`,
      ephemeral: true,
    });
  }

  return true;
}

async function startQuizFromInteraction(interaction) {
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased?.()) {
    await interaction.editReply({ content: "❌ Can't start a quiz in this channel." });
    return { success: false };
  }

  try {
    const result = await postQuiz(channel, {
      requestedBy: interaction.user?.username || interaction.user?.tag,
    });
    if (!result.success) {
      await interaction.editReply({ content: `⏳ ${result.message}` });
      return result;
    }
    await interaction.editReply({ content: "✅ Quiz posted!" });
    return result;
  } catch (err) {
    console.error("Error starting quiz:", err);
    await interaction.editReply({
      content: `❌ Could not start quiz: ${err.message}`,
    });
    return { success: false, message: err.message };
  }
}

/**
 * Start a quiz from AI chat / mention (posts in the same channel).
 */
async function startQuizFromMessage(message) {
  const channel = message.channel;
  try {
    const result = await postQuiz(channel, {
      requestedBy: message.author?.username,
    });
    if (!result.success) {
      await message.reply(`⏳ ${result.message}`);
      return result;
    }
    // Quiz message is already public; no need for a second reply
    return result;
  } catch (err) {
    console.error("Error starting quiz from message:", err);
    await message.reply(`❌ Could not start quiz: ${err.message}`);
    return { success: false, message: err.message };
  }
}

async function maybePostScheduledQuiz(client) {
  const channelId = config.quiz?.channelId;
  if (!channelId) return;

  const tz = config.quiz?.tz || "Europe/Paris";
  const targetHour = Number.isFinite(config.quiz?.hour) ? config.quiz.hour : 18;
  const targetMinute = Number.isFinite(config.quiz?.minute) ? config.quiz.minute : 0;
  const probability = Number.isFinite(config.quiz?.probability)
    ? config.quiz.probability
    : 0.4;

  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  if (local.getHours() !== targetHour || local.getMinutes() !== targetMinute) {
    return;
  }

  const { getBotState, setBotState } = require("./firebase");
  const pad2 = (n) => String(n).padStart(2, "0");
  const todayKey = `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`;
  const stateKey = "zwift_quiz_daily";
  const existing = await getBotState(stateKey);
  if (existing?.lastRunDate === todayKey) return;

  const roll = Math.random();
  const shouldPost = roll < probability;

  await setBotState(stateKey, {
    lastRunDate: todayKey,
    rolled: roll,
    posted: shouldPost,
    updatedAt: new Date().toISOString(),
  });

  if (!shouldPost) {
    console.log(
      `🎲 Daily quiz skipped (roll=${roll.toFixed(3)}, need < ${probability})`
    );
    return;
  }

  try {
    const channel =
      client.channels.cache.get(channelId) ||
      (await client.channels.fetch(channelId));
    if (!channel) {
      console.error(`❌ Quiz channel ${channelId} not found`);
      return;
    }
    console.log(`🧠 Posting scheduled Zwift quiz to #${channel.name}...`);
    await postQuiz(channel);
  } catch (err) {
    console.error("❌ Scheduled quiz failed:", err.message || err);
  }
}

module.exports = {
  postQuiz,
  handleQuizButton,
  startQuizFromInteraction,
  startQuizFromMessage,
  maybePostScheduledQuiz,
};
