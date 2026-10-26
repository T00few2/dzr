const test = require('node:test');
const assert = require('node:assert/strict');
const { createVerificationFixture } = require('./test-support/verification');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('overlapping verification calls fetch fresh state and assign once', async () => {
  const f = createVerificationFixture();
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
  const staleMember = f.member();
  const results = await Promise.all(Array.from({ length: 4 }, () => f.service.processVerification(staleMember)));
  assert.equal(results.filter(result => result.action === 'role_assigned').length, 1);
  assert.deepEqual(f.state.roleCalls, [{ id: 'verified', present: true }]);
  assert.equal(f.service.pendingVerifications.size, 0);
  await f.drainEvents();
  assert.equal(f.state.messages.length, 1);
});

for (const failure of ['users', 'verificationSettings', 'discord']) {
  test(`${failure} lookup failure preserves an existing verified role and allows later checks`, async () => {
    const f = createVerificationFixture();
    f.state.roles.add('verified');
    f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
    f.state.failCollection = failure;
    f.state.failDiscord = failure === 'discord';
    const result = await f.service.processVerification(f.member());
    assert.equal(result.processed, false);
    assert.deepEqual(f.state.roleCalls, []);
    assert.equal(f.service.pendingVerifications.size, 0);
    if (failure !== 'discord') assert.equal(await f.service.getVerificationStatus(f.member()), null);
    f.state.failCollection = null;
    f.state.failDiscord = false;
    assert.equal((await f.service.processVerification(f.member())).reason, 'Already has role');
  });
}

test('a role snapshot taken before Zwift linking cannot remove the later verified assignment', async () => {
  const f = createVerificationFixture();
  const readingUser = deferred();
  const continueRead = deferred();
  f.state.beforeRead = async name => {
    if (name !== 'users') return;
    readingUser.resolve();
    await continueRead.promise;
  };
  const pending = f.service.processVerification(f.member());
  await readingUser.promise;
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
  f.changeRole('verified', true);
  continueRead.resolve();
  await pending;
  await f.drainEvents();
  assert.equal(f.state.mutations.filter(change => !change.present).length, 0);
  assert.equal(f.state.messages.length, 1);
});

test('queued checks refresh the member instead of reusing an old event', async () => {
  const f = createVerificationFixture();
  const stale = f.member();
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
  f.state.roles.add('verified');
  const result = await f.service.processVerification(stale);
  assert.equal(result.reason, 'Already has role');
  assert.deepEqual(f.state.roleCalls, []);
});

test('verification queues do not block different members', async () => {
  const f = createVerificationFixture();
  const blocked = deferred();
  const entered = deferred();
  f.state.beforeMemberFetch = async ({ user, force }) => {
    assert.equal(force, true);
    if (user !== f.state.userId) return;
    entered.resolve();
    await blocked.promise;
  };
  const first = f.service.processVerification(f.member());
  await entered.promise;
  const other = { ...f.member(), id: '200000000000000000' };
  const second = await f.service.processVerification(other);
  assert.equal(second.processed, false);
  blocked.resolve();
  await first;
});

test('missing and disabled verification configurations never change bot roles', async () => {
  const f = createVerificationFixture();
  const key = `verificationSettings/${f.state.guildId}`;
  for (const settings of [undefined, { enabled: false, verifiedRoleId: 'verified' }]) {
    if (settings) f.state.docs.set(key, settings);
    else f.state.docs.delete(key);
    f.state.roles.add('verified');
    assert.equal((await f.service.processVerification(f.member())).processed, false);
    assert.deepEqual(f.state.roleCalls, []);
  }
});

test('real removal and later re-verification send each configured message again', async () => {
  const f = createVerificationFixture();
  f.state.templates.push({ ...f.state.templates[0], id: 'second-template' });
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
  await f.service.processVerification(f.member());
  await f.drainEvents();
  assert.equal(f.state.messages.length, 2);
  f.state.docs.delete(`users/${f.state.userId}`);
  await f.service.processVerification(f.member());
  await f.drainEvents();
  assert.equal(f.state.roles.has('verified'), false);
  f.state.docs.set(`users/${f.state.userId}`, { zwiftId: '12345' });
  await f.service.processVerification(f.member());
  await f.drainEvents();
  assert.equal(f.state.messages.length, 4);
});

test('onboarding runs for the community, verified and club roles, not for team roles', async () => {
  const shared = require('../constants.json');
  const f = createVerificationFixture();
  const triggerFor = async roleId => {
    f.state.onboarding.length = 0;
    const before = f.member();
    const after = f.member();
    after.roles.cache = new Map([[roleId, { id: roleId, name: roleId }]]);
    after.roles.cache.filter = predicate => new Map([...after.roles.cache].filter(([, role]) => predicate(role)));
    await f.handler.handleGuildMemberUpdate(before, after);
    return f.state.onboarding.map(call => call.trigger);
  };
  assert.deepEqual(await triggerFor(shared.discord.roles.communityMember), ['community']);
  assert.deepEqual(await triggerFor(shared.discord.roles.verifiedMember), ['role']);
  assert.deepEqual(await triggerFor('club'), ['role']);
  assert.deepEqual(await triggerFor('custom'), []);
});
