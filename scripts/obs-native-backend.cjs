const assert = require('node:assert/strict');
const { memoryDb } = require('../apps/bot/services/streaming/test-support');
const { createStore } = require('../apps/bot/services/streaming/store');
const { createStreamingService } = require('../apps/bot/services/streaming/service');
const { createHttpApp } = require('../apps/bot/services/server');

// No Firebase initialization or Discord client: exercise production authentication,
// transactions and HTTP routing against a fresh, private in-memory database.
async function createNativeBackend() {
  const guildId = '333333333333333333';
  const userId = '111111111111111111';
  const db = memoryDb();
  let announcements = 0, providerChecks = 0;
  const accepted = [];
  const service = createStreamingService({
    store: createStore(db), guildId, channelId: '555555555555555555',
    providers: {
      async resolveChannel() {
        return { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', title: 'OBS CI fixture', url: 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa' };
      },
      async verify() { providerChecks++; return { streams: [], state: {} }; },
    },
    publisher: {
      async send() { announcements++; throw new Error('connection test must not publish'); },
      async reportError() { throw new Error('unexpected native smoke callback error'); },
    },
    logger: { warn() {} },
  });
  const { token } = await service.enroll(userId, 'OBS CI fixture', { youtube: '@OBS-fixture' }, { createOnly: true });
  const realCallback = service.callback;
  service.callback = async (key, body) => {
    const result = await realCallback(key, body);
    // Deliberately retain no key, headers or arbitrary request payload.
    accepted.push({ event: body.event, sequence: body.sequence });
    return result;
  };
  return {
    app: createHttpApp({ streaming: service }), token,
    async getResult() {
      assert.ok(accepted.length > 0, 'OBS has not sent an authenticated callback');
      assert.ok(accepted.every(item => item.event === 'test'), 'native smoke must only send connection-test events');
      await service.tick();
      const registration = await service.getRegistration(userId);
      assert.ok(registration.lastCallbackAt > 0, 'the real store must record the OBS signal');
      assert.equal(announcements, 0, 'connection test must not publish');
      assert.equal(providerChecks, 0, 'connection test must not discover streams');
      assert.ok(!JSON.stringify([...db.documents]).includes(token), 'plaintext key must not be persisted');
      return { authenticatedCallbacks: accepted.length, lastCallbackAt: registration.lastCallbackAt,
        announcements, providerChecks, events: accepted };
    },
  };
}

module.exports = { createNativeBackend };
