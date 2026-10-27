const { readFileSync } = require('node:fs');
const path = require('node:path');

// Run the real service/handler without initializing Firebase or logging in to Discord.
function loadCommonJs(source, dependencies, globals = {}) {
  const module = { exports: {} };
  const requireMock = name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  const run = new Function('require', 'module', 'exports', ...Object.keys(globals), source);
  run(requireMock, module, module.exports, ...Object.values(globals));
  return module.exports;
}

class RoleCache extends Map {
  filter(predicate) {
    return new RoleCache([...this].filter(([, role]) => predicate(role)));
  }
}

function createVerificationFixture() {
  const userId = '100000000000000000';
  const guildId = 'guild';
  const docs = new Map([
    [`verificationSettings/${guildId}`, { enabled: true, verifiedRoleId: 'verified', criteria: { requiresZwiftId: true } }],
    ['system_settings/global', { membership: { memberRoleId: 'community', clubMemberRoleId: 'club' } }],
  ]);
  const state = {
    userId, guildId, docs,
    roles: new Set(), events: [], onboarding: [], onboardingOutcome: 'nothing_due', messages: [], mutations: [], roleCalls: [], queued: [], logs: [],
    failCollection: null, failDiscord: false, failRoleWrite: false,
    beforeRead: null, beforeMemberFetch: null,
    premiumSince: null,
    templates: [{ id: 'verified-message', active: true, role_id: 'verified', channel_id: 'announcements', title: 'Verified', content: 'Verified {mention}' }],
  };
  const quietConsole = Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, (...args) => state.logs.push(args)]));
  const db = {
    collection: name => ({
      doc: id => ({
        get: async () => {
          if (state.beforeRead) await state.beforeRead(name, id);
          if (state.failCollection === name) throw new Error(`${name} unavailable`);
          const data = docs.get(`${name}/${id}`);
          return { exists: data !== undefined, data: () => data };
        },
        set: async (data, options) => {
          const key = `${name}/${id}`;
          docs.set(key, options?.merge ? { ...docs.get(key), ...data } : data);
        },
      }),
      add: async data => {
        state.queued.push({ collection: name, ...data });
        return { id: `queued-${state.queued.length}` };
      },
    }),
  };
  const role = id => ({ id, name: id, hexColor: '#ffffff' });
  const guild = {
    id: guildId, name: 'DZR', memberCount: 1,
    roles: { cache: new Map(['verified', 'community', 'club', 'custom'].map(id => [id, role(id)])) },
    channels: { cache: new Map([['announcements', { name: 'announcements', send: async message => state.messages.push(message) }]]) },
    members: { fetch: async options => {
      if (state.beforeMemberFetch) await state.beforeMemberFetch(options);
      if (state.failDiscord) throw new Error('Discord unavailable');
      return member();
    } },
  };
  function member() {
    return {
      id: userId, guild, displayName: 'Rider', premiumSince: state.premiumSince,
      user: { id: userId, username: 'Rider', createdTimestamp: Number(BigInt(userId) >> 22n) + 1420070400000 },
      roles: {
        cache: new RoleCache([...state.roles].map(id => [id, role(id)])),
        add: async id => changeRole(id, true),
        remove: async id => changeRole(id, false),
      },
    };
  }
  function changeRole(id, present) {
    state.roleCalls.push({ id, present });
    if (state.failRoleWrite) throw new Error('Role write failed');
    if (state.roles.has(id) === present) return;
    const oldMember = member();
    if (present) state.roles.add(id);
    else state.roles.delete(id);
    state.mutations.push({ id, present });
    state.events.push([oldMember, member()]);
  }
  const botPath = path.resolve(__dirname, '../verificationService.js');
  const service = loadCommonJs(readFileSync(botPath, 'utf8'), {
    './firebase': { db, getUserZwiftId: async id => (await db.collection('users').doc(id).get()).data()?.zwiftId },
    './verificationCriteria': require('../verificationCriteria'),
  }, { console: quietConsole });
  const handler = loadCommonJs(readFileSync(path.resolve(__dirname, '../../handlers/memberHandler.js'), 'utf8'), {
    'discord.js': { EmbedBuilder: class {} },
    '../services/contentApi': { processMessageContent: (content, variables = {}) => content.replace(/{(\w+)}/g, (match, key) => key in variables ? variables[key] : match) },
    '../config/config': { contentApi: { baseUrl: 'https://content.test', apiKey: 'test' } },
    '../services/verificationService': service,
    '../services/newMemberService': { ensureNewMemberRole: async () => {} },
    '../services/onboardingDm': {
      runOnboarding: async options => { state.onboarding.push(options); return { outcome: state.onboardingOutcome }; },
      DM_HINTS: { join: 'JOIN-HINT', role: 'ROLE-HINT' },
    },
    '../services/onboardingStatus': { getClubRoleId: async () => 'club' },
    '../constants.json': require('../../constants.json'),
  }, {
    console: quietConsole,
    fetch: async url => {
      if (url !== 'https://content.test/api/messages/role-messages') throw new Error(`Unexpected URL: ${url}`);
      return { ok: true, json: async () => state.templates };
    },
  });
  async function drainEvents() {
    let count = 0;
    while (state.events.length) {
      if (++count > 100) throw new Error('Role feedback loop');
      await handler.handleGuildMemberUpdate(...state.events.shift());
    }
  }
  return { state, db, guild, member, changeRole, service, handler, drainEvents, quietConsole };
}

module.exports = { loadCommonJs, createVerificationFixture };
