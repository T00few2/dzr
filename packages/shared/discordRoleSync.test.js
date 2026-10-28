const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadCommonJs, createVerificationFixture } = require('../../apps/bot/services/test-support/verification');
const sharedCriteria = require('./verificationCriteria');

// Transpile production website code, as in the stats tests; all I/O is isolated.
function compileWebsite(file) {
  return ts.transpileModule(readFileSync(path.resolve(__dirname, '../../app', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
}
const outputText = compileWebsite('utils/discordRoleSync.ts');

function createJoinFixture() {
  const f = createVerificationFixture();
  f.state.httpCalls = [];
  const env = { DISCORD_GUILD_ID: f.state.guildId, DISCORD_BOT_TOKEN: 'test', DISCORD_REQUIRED_ROLE_ID: 'verified' };
  const website = loadCommonJs(outputText, {
    '@/app/lib/sharedConstants': { VERIFIED_MEMBER_ROLE_ID: 'verified', COMMUNITY_MEMBER_ROLE_ID: 'community' },
    '@/app/utils/firebaseAdminConfig': { adminDb: f.db },
    '@/packages/shared/verificationCriteria': sharedCriteria,
  }, {
    process: { env }, console: f.quietConsole,
    fetch: async (url, options) => {
      f.state.httpCalls.push({ url, ...options });
      const match = new URL(url).pathname.match(/^\/api\/v10\/guilds\/guild\/members\/(\d+)(?:\/roles\/([^/]+))?$/);
      assert.ok(match, `Unexpected URL: ${url}`);
      assert.equal(match[1], f.state.userId);
      if (f.state.failDiscord) return { ok: false, status: 503 };
      if (!match[2]) {
        assert.equal(options.cache, 'no-store');
        return { ok: true, json: async () => ({ roles: [...f.state.roles], premium_since: f.state.premiumSince }) };
      }
      assert.ok(['PUT', 'DELETE'].includes(options.method));
      f.changeRole(match[2], options.method === 'PUT');
      return { ok: true, status: 204 };
    },
  });
  return { ...f, env, website };
}

function linkZwift(f) {
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
}
function recordPayment(f) {
  f.state.docs.set(`memberships/${f.state.userId}`, { currentStatus: 'club', coveredThroughYear: new Date().getUTCFullYear() });
}
function sync(f, source = 'test') {
  return f.website.syncMemberRoleOnLogin({ userId: f.state.userId, source });
}

test('join login, payment and Zwift linking produce one Verified transition and announcement', async () => {
  const f = createJoinFixture();
  await f.website.syncAccessRoles(f.state.userId, 'onboarding-discord-login');
  await f.drainEvents();
  assert.equal(f.state.roles.has('community'), true);
  assert.equal(f.state.roles.has('verified'), false);
  assert.equal(f.state.messages.length, 0);

  recordPayment(f);
  await f.website.syncClubMemberRole({ userId: f.state.userId, coveredThroughYear: new Date().getUTCFullYear(), source: 'onboarding-payment' });
  await sync(f, 'onboarding-payment');
  await f.drainEvents();
  assert.equal(f.state.roles.has('club'), true);
  assert.equal(f.state.roles.has('verified'), false);
  assert.equal(f.state.messages.length, 0);

  linkZwift(f);
  await f.website.syncAccessRoles(f.state.userId, 'onboarding-complete');
  await f.drainEvents();
  assert.equal(f.state.roles.has('verified'), true);
  assert.deepEqual(f.state.mutations.filter(change => change.id === 'verified'), [{ id: 'verified', present: true }]);
  assert.equal(f.state.messages.length, 1);

  await f.website.syncAccessRoles(f.state.userId, 'returning-member-login');
  await f.drainEvents();
  assert.equal(f.state.messages.length, 1);
  assert.equal(f.state.roleCalls.filter(change => change.id === 'verified').length, 1);
});

test('overlapping callbacks and bot checks cannot create repeated Verified transitions after linking', async () => {
  const f = createJoinFixture();
  linkZwift(f);
  recordPayment(f);
  const staleMember = f.member();
  await Promise.all([
    ...Array.from({ length: 4 }, () => f.website.syncAccessRoles(f.state.userId, 'onboarding-complete')),
    f.service.processVerification(staleMember),
    f.service.processVerification(staleMember),
  ]);
  await f.drainEvents();
  assert.deepEqual(f.state.mutations.filter(change => change.id === 'verified'), [{ id: 'verified', present: true }]);
  assert.equal(f.state.messages.length, 1);
});

for (const failure of ['users', 'verificationSettings', 'discord']) {
  test(`${failure} lookup failure skips Verified without rejecting the join role sync`, async () => {
    const f = createJoinFixture();
    linkZwift(f);
    recordPayment(f);
    f.state.failCollection = failure;
    f.state.failDiscord = failure === 'discord';
    const result = await sync(f);
    if (failure === 'discord') {
      // Ordinary role writes still use the existing queue when Discord itself is unavailable.
      assert.equal(result.status, 'queued');
      assert.equal(result.roleId, 'community');
    } else {
      assert.deepEqual(result, { status: 'skipped', reason: 'verification_unavailable' });
    }
    await f.website.syncAccessRoles(f.state.userId, 'onboarding-complete');
    assert.equal(f.state.roles.has('verified'), false);
    assert.equal(f.state.queued.some(item => item.addRoleIds.includes('verified')), false);
    if (failure !== 'discord') assert.equal(f.state.roles.has('club'), true);
    if (failure === 'users') assert.equal(f.state.roles.has('community'), true);
    f.state.failCollection = null;
    f.state.failDiscord = false;
    assert.equal((await sync(f)).status, 'succeeded');
  });
}

test('missing or disabled settings use linked Zwift as the website fallback', async () => {
  for (const settings of [undefined, { enabled: false, verifiedRoleId: 'verified', criteria: { requiresZwiftId: false } }]) {
    const f = createJoinFixture();
    const key = `verificationSettings/${f.state.guildId}`;
    if (settings) f.state.docs.set(key, settings);
    else f.state.docs.delete(key);
    assert.equal((await sync(f)).reason, 'verification_requirements_not_met');
    assert.equal(f.state.roles.has('community'), true);
    linkZwift(f);
    assert.equal((await sync(f)).status, 'succeeded');
    await f.drainEvents();
    assert.equal(f.state.roles.has('verified'), true);
    assert.equal(f.state.messages.length, 1);
  }
});

test('a configured alternate verified role uses its criteria while login uses the fallback', async () => {
  const f = createJoinFixture();
  f.state.docs.set('system_settings/global', { membership: { memberRoleId: 'custom' } });
  f.state.docs.set(`verificationSettings/${f.state.guildId}`, {
    enabled: true, verifiedRoleId: 'custom', criteria: { requiresZwiftId: false, requiresServerBoost: true },
  });
  linkZwift(f);
  assert.equal((await sync(f)).reason, 'verification_requirements_not_met');
  assert.equal(f.state.roles.has('verified'), true);
  assert.equal(f.state.roles.has('custom'), false);
  f.state.premiumSince = new Date();
  assert.equal((await sync(f)).status, 'succeeded');
  await f.drainEvents();
  assert.equal(f.state.roles.has('custom'), true);
  assert.equal(f.state.mutations.some(change => !change.present), false);
});

test('an overridden login role also requires Zwift even when bot verification is disabled', async () => {
  const f = createJoinFixture();
  f.env.DISCORD_REQUIRED_ROLE_ID = 'custom';
  f.state.docs.delete(`verificationSettings/${f.state.guildId}`);
  assert.equal((await sync(f)).reason, 'verification_requirements_not_met');
  assert.equal(f.state.roles.has('custom'), false);
  linkZwift(f);
  assert.equal((await sync(f)).status, 'succeeded');
  assert.equal(f.state.roles.has('custom'), true);
});

for (const [name, criteria, prepare] of [
  ['Zwift ID', { requiresZwiftId: true }, () => {}],
  ['account age', { requiresMinimumAccountAge: true, minimumAccountAgeDays: 100000 }, linkZwift],
  ['required roles', { requiresSpecificRoles: ['club'] }, linkZwift],
  ['server boost', { requiresServerBoost: true }, linkZwift],
]) {
  test(`website and bot both withhold Verified when ${name} is missing`, async () => {
    const f = createJoinFixture();
    f.state.docs.set(`verificationSettings/${f.state.guildId}`, {
      enabled: true, verifiedRoleId: 'verified', criteria: { requiresZwiftId: true, ...criteria },
    });
    prepare(f);
    assert.equal((await sync(f)).reason, 'verification_requirements_not_met');
    await f.drainEvents();
    assert.equal(f.state.roles.has('verified'), false);
    assert.equal((await f.service.processVerification(f.member())).reason, "Doesn't meet criteria");
    assert.equal(f.state.messages.length, 0);
  });
}

test('an explicit opt-out of Zwift verification does not require a users lookup', async () => {
  const f = createJoinFixture();
  f.state.docs.set(`verificationSettings/${f.state.guildId}`, { enabled: true, verifiedRoleId: 'verified', criteria: { requiresZwiftId: false } });
  f.state.failCollection = 'users';
  assert.equal((await sync(f)).status, 'succeeded');
  await f.drainEvents();
  assert.equal(f.state.messages.length, 1);
});

test('failed eligible role writes retain the existing queue behavior; ineligible roles are never queued', async () => {
  const f = createJoinFixture();
  f.state.failRoleWrite = true;
  assert.equal((await sync(f)).status, 'queued');
  assert.deepEqual(f.state.queued[0].addRoleIds, ['community']);
  linkZwift(f);
  assert.equal((await sync(f)).status, 'queued');
  assert.deepEqual(f.state.queued[1].addRoleIds, ['verified', 'community']);
});

function loadOnboardingModules(f) {
  const sessionId = 'onboarding-session';
  f.state.docs.set(`onboarding_sessions/${sessionId}`, {
    discordId: f.state.userId,
    steps: { discordLinked: true, paymentSucceeded: false, zwiftLinked: false },
  });
  const session = {
    updateOnboardingSession: async (id, data) => f.db.collection('onboarding_sessions').doc(id).set(data, { merge: true }),
    getOnboardingSessionFromRequest: async () => ({ sessionId, session: f.state.docs.get(`onboarding_sessions/${sessionId}`) }),
  };
  const dependencies = {
    '@/app/utils/firebaseAdminConfig': { adminDb: f.db },
    '@/app/utils/discordRoleSync': f.website,
    '@/app/api/onboarding/_lib/session': session,
    '@/app/lib/ensureCoachProfile': { ensureDefaultCoachProfile: async () => {} },
    '@/app/api/membership/vippsClient': {
      vippsGetCheckoutSession: async () => ({ sessionState: 'PaymentSuccessful', paymentDetails: { state: 'CAPTURED', amount: { value: 10000, currency: 'DKK' } } }),
      vippsCapturePayment: async () => { throw new Error('Already captured; must not capture again'); },
    },
    'next/server': { NextResponse: { json: (body, { status }) => ({ body, status }) } },
  };
  const globals = { console: f.quietConsole };
  const payment = loadCommonJs(compileWebsite('api/onboarding/_lib/payment.ts'), dependencies, globals);
  const zwift = loadCommonJs(compileWebsite('api/onboarding/zwift-id/route.ts'), dependencies, globals);
  f.state.docs.set('payments/checkout_test', { onboardingSessionId: sessionId, userId: f.state.userId, amountDkk: 100 });
  return { payment, zwift, sessionId };
}

for (const failCollection of [null, 'users', 'verificationSettings']) {
  test(`payment confirmation and join completion survive ${failCollection || 'no'} verification lookup failure`, async () => {
    const f = createJoinFixture();
    const { payment, zwift, sessionId } = loadOnboardingModules(f);
    f.state.failCollection = failCollection;
    assert.deepEqual(await payment.processOnboardingPayment('test', sessionId), { status: 'succeeded', reference: 'test' });
    // Repeated confirmation must retain the existing payment/session behavior.
    assert.equal((await payment.processOnboardingPayment('test', sessionId)).status, 'succeeded');
    assert.equal(f.state.docs.get(`memberships/${f.state.userId}`).currentStatus, 'club');
    assert.equal(f.state.docs.get('payments/checkout_test').status, 'succeeded');
    assert.equal(f.state.docs.get(`onboarding_sessions/${sessionId}`).steps.paymentSucceeded, true);
    assert.equal(f.state.roles.has('verified'), false);

    const response = await zwift.POST({ json: async () => ({ zwiftId: '12345' }) });
    assert.equal(response.status, 200);
    assert.equal(f.state.docs.get(`users/${f.state.userId}`).zwiftId, '12345');
    assert.equal(f.state.docs.get(`onboarding_sessions/${sessionId}`).status, 'completed');
    assert.equal(f.state.roles.has('club'), true);
    assert.equal(f.state.roles.has('verified'), failCollection === null);
    await f.drainEvents();
    assert.equal(f.state.messages.length, failCollection === null ? 1 : 0);
  });
}

test('a paid member can still sign in before linking Zwift or obtaining Verified', async () => {
  const f = createJoinFixture();
  recordPayment(f);
  await f.website.syncAccessRoles(f.state.userId, 'onboarding-payment');
  assert.equal(f.state.roles.has('verified'), false);
  const auth = loadCommonJs(compileWebsite('api/auth/[...nextauth]/route.ts'), {
    'next-auth': options => options,
    'next-auth/providers/discord': options => options,
    '@/app/lib/sharedConstants': {
      ADMIN_ROLE_ID: 'admin', VERIFIED_MEMBER_ROLE_ID: 'verified', DISCORD_GUILD_ID_DEFAULT: f.state.guildId,
      COLLECTIONS: { memberships: 'memberships', payments: 'payments' },
    },
    '@/app/utils/firebaseAdminConfig': { adminDb: f.db },
    '@/packages/shared/coach/membership': require('./coach/membership'),
  }, {
    process: { env: f.env }, console: f.quietConsole,
    fetch: async () => ({ ok: true, json: async () => ({ roles: [...f.state.roles] }) }),
  });
  assert.equal(await auth.GET.callbacks.signIn({ account: { access_token: 'test' }, profile: { id: f.state.userId } }), true);
});

test('without a memberRoleId setting, the join login still adds the community member role', async () => {
  const f = createJoinFixture();
  f.state.docs.set('system_settings/global', { membership: { clubMemberRoleId: 'club' } });
  await f.website.syncAccessRoles(f.state.userId, 'onboarding-discord-login');
  assert.equal(f.state.roles.has('community'), true);
  assert.equal(f.state.roles.has('verified'), false);
});
