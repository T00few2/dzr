const test = require('node:test');
const assert = require('node:assert/strict');
const { createNativeBackend } = require('../../../../scripts/obs-native-backend.cjs');

test('native OBS fixture uses real HTTP authentication and store; only a real accepted callback produces proof', async t => {
  const fixture = await createNativeBackend();
  await assert.rejects(fixture.getResult(), /has not sent an authenticated callback/);
  const listener = fixture.app.listen(0, '127.0.0.1');
  await new Promise(resolve => listener.once('listening', resolve));
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const now = Date.now();
  const url = `http://127.0.0.1:${listener.address().port}/streaming/obs`;
  const post = key => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'test', platform: null, sessionId: 'native_smoke_123456789', sequence: 1, sentAt: now, startedAt: now }) });
  assert.equal((await post('wrong-key')).status, 401);
  await assert.rejects(fixture.getResult(), /has not sent an authenticated callback/);
  assert.equal((await post(fixture.token)).status, 202);
  const result = await fixture.getResult();
  assert.equal(result.authenticatedCallbacks, 1);
  assert.ok(result.lastCallbackAt >= now);
  assert.equal(result.announcements, 0);
  assert.equal(result.providerChecks, 0);
  assert.deepEqual(result.events, [{ event: 'test', sequence: 1 }]);
  assert.ok(!JSON.stringify(result).includes(fixture.token));
});
