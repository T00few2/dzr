const { REST, Routes } = require("discord.js");

function createPublisher(client, guildId, { rest: suppliedRest } = {}) {
  // Keep network attempts shorter than the durable lease. In particular, do not let the
  // main bot's REST queue hold an announcement through a long rate limit and send it later.
  const rest = suppliedRest || new REST({ version: "10", timeout: 8000, retries: 0, rejectOnRateLimit: () => true });
  const api = () => suppliedRest || rest.setToken(client.token);
  async function getChannel(id) {
    const channel = await api().get(Routes.channel(id));
    if (channel?.guild_id !== guildId || ![0, 5, 10, 11, 12].includes(channel.type)) throw new Error("invalid_streaming_channel");
  }
  return {
    async send(notice, message) {
      await getChannel(notice.channelId);
      const { allowedMentions, ...body } = message;
      return (await api().post(Routes.channelMessages(notice.channelId), { body: {
        ...body, allowed_mentions: allowedMentions, nonce: notice.nonce, enforce_nonce: true,
      } })).id;
    },
    async findExisting(notice) {
      await getChannel(notice.channelId);
      let before;
      // Covers a busy channel and resumes safely after process death between send and receipt storage.
      for (let page = 0; page < 10; page++) {
        const messages = await api().get(Routes.channelMessages(notice.channelId), {
          query: new URLSearchParams({ limit: "100", ...(before ? { before } : {}) }),
        });
        if (!messages.length) return { complete: true };
        for (const message of messages) {
          if (message.author.id === client.user.id && message.embeds.some((embed) => embed.url === notice.stream.url
              && Date.parse(embed.timestamp) === Date.parse(notice.stream.startedAt))) return { complete: true, messageId: message.id };
        }
        const oldest = messages.reduce((a, b) => Date.parse(a.timestamp) < Date.parse(b.timestamp) ? a : b);
        if (Date.parse(oldest.timestamp) < notice.firstAttemptAt - 5000 || messages.length < 100) return { complete: true };
        before = oldest.id;
      }
      return { complete: false };
    },
  };
}

module.exports = { createPublisher };
