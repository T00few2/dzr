const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the real website adapter, without Firebase or Discord credentials.
test('join grants Verified after Zwift linking, not at login or payment', async () => {
  const userId = '100000000000000000';
  const roles = new Set();
  const writes = [];
  let zwiftId = null;
  let lookupFails = false;
  async function readDocument(name) {
    if (name === 'users' && lookupFails) throw new Error('Lookup unavailable');
    const data = {
      system_settings: { membership: { memberRoleId: 'community' } },
      verificationSettings: { enabled: true, verifiedRoleId: 'verified', criteria: { requiresZwiftId: true } },
      users: { zwiftId },
    }[name];
    assert.ok(data, `Unexpected collection: ${name}`);
    return { exists: true, data: () => data };
  }
  const db = { collection: name => ({ doc: () => ({ get: () => readDocument(name) }) }) };
  const dependencies = {
    '@/app/lib/sharedConstants': { VERIFIED_MEMBER_ROLE_ID: 'verified' },
    '@/app/utils/firebaseAdminConfig': { adminDb: db },
    '@/packages/shared/verificationCriteria': require('./verificationCriteria'),
  };
  const fetch = async (url, options) => {
    if (!options.method) return { ok: true, json: async () => ({ roles: [...roles], premium_since: null }) };
    assert.equal(options.method, 'PUT');
    const roleId = url.split('/').pop();
    writes.push(roleId);
    roles.add(roleId);
    return { ok: true };
  };
  const source = readFileSync(path.resolve(__dirname, '../../app/utils/discordRoleSync.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('require', 'exports', 'process', 'fetch', 'console', outputText)(
    name => { assert.ok(name in dependencies); return dependencies[name]; }, module.exports,
    { env: { DISCORD_GUILD_ID: 'guild', DISCORD_BOT_TOKEN: 'test' } }, fetch, { error() {} },
  );
  const sync = source => module.exports.syncMemberRoleOnLogin({ userId, source });

  for (const step of ['onboarding-discord-login', 'onboarding-payment']) {
    assert.equal((await sync(step)).reason, 'verification_requirements_not_met');
    assert.equal(roles.has('verified'), false);
    assert.equal(roles.has('community'), true);
  }
  lookupFails = true;
  assert.equal((await sync('onboarding-complete')).reason, 'verification_unavailable');
  assert.equal(roles.has('verified'), false);
  lookupFails = false;
  zwiftId = '12345';
  assert.equal((await sync('onboarding-complete')).status, 'succeeded');
  assert.equal(roles.has('verified'), true);
  await sync('returning-member-login');
  assert.deepEqual(writes.filter(role => role === 'verified'), ['verified']);
});
