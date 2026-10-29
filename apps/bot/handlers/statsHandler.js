const { StatsCollector } = require('../services/statsCollector');
const { noteActivity } = require('../services/announcer/dmReminders');

// Create a single instance of the stats collector
const statsCollector = new StatsCollector();

/**
 * Handle message creation for stats
 */
function handleMessageCreate(message) {
  statsCollector.addMessage(message);
  // Server activity is when a DM reminder is most likely to be seen.
  if (message.guildId && !message.author?.bot) noteActivity(message.author.id);
}

/**
 * Handle message reactions for stats
 */
function handleMessageReactionAdd(reaction, user) {
  statsCollector.addReaction(reaction, user);
  if (reaction.message?.guildId && !user?.bot) noteActivity(user.id);
}

/**
 * Handle voice state updates for stats
 */
function handleVoiceStateUpdate(oldState, newState) {
  statsCollector.addVoiceActivity(oldState, newState);
  if (!oldState.channelId && newState.channelId && !newState.member?.user?.bot) noteActivity(newState.id);
}

/**
 * Handle interactions for stats (already tracked via interactionCreate)
 */
function handleInteractionCreate(interaction) {
  statsCollector.addInteraction(interaction);
}

/**
 * Force save stats (useful for graceful shutdown)
 */
function forceSaveStats() {
  statsCollector.forceSave();
}

/**
 * Get current stats buffer info (for debugging)
 */
function getStatsInfo() {
  return {
    totalActivities: statsCollector.getTotalActivityCount(),
    lastSave: new Date(statsCollector.lastSave).toISOString(),
    timeSinceLastSave: Date.now() - statsCollector.lastSave,
    threshold: statsCollector.ACTIVITY_THRESHOLD,
    maxWaitTime: statsCollector.MAX_WAIT_TIME
  };
}

module.exports = {
  handleMessageCreate,
  handleMessageReactionAdd,
  handleVoiceStateUpdate,
  handleInteractionCreate,
  forceSaveStats,
  getStatsInfo
}; 