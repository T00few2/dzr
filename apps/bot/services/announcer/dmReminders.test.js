const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeDb } = require("./testDb");
const { reminderStep, decideReminder, reminderText, noteActivity, takeDue, processDue, resetSchedule, REMINDER_STEPS, COLLECTION } = require("./dmReminders");
const { DEFAULTS } = require("./settings");

const NOW = new Date("2026-10-29T11:00:00Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const CFG = DEFAULTS.dmReminders;
const ago = (days) => new Date(NOW.getTime() - days * DAY);

test("the step: onboarding's next step first, then the Companion club for verified members", () => {
  assert.equal(reminderStep({ inServer: true, nextStep: "link_zwift_id_channel" }, null), "link_zwift_id_channel");
  assert.equal(reminderStep({ inServer: true, nextStep: "connect_intervals", verified: true, zwiftId: "1" }, false), "connect_intervals");
  assert.equal(reminderStep({ inServer: true, nextStep: "become_club_member", verified: true, zwiftId: "1" }, false), "join_companion");
  assert.equal(reminderStep({ inServer: true, nextStep: "done", verified: true, zwiftId: "1" }, true), null);
  assert.equal(reminderStep({ inServer: true, nextStep: "done", verified: true, zwiftId: "1" }, null), null);
  assert.equal(reminderStep({ inServer: true, nextStep: "meet_verification" }, null), null);
  assert.equal(reminderStep({ inServer: false }, false), null);
});

test("every reminder step has a text that never mentions the member's activity", () => {
  for (const step of REMINDER_STEPS) {
    const text = reminderText(step);
    assert.ok(text, step);
    assert.doesNotMatch(text, /aktiv|online|så dig/i);
  }
});

test("limits: recent DMs, per-member spacing, max per step, snooze, closed DMs and test users", () => {
  const ok = (doc, step = "join_companion") => decideReminder(doc, step, NOW.getTime(), CFG);
  assert.equal(ok({}).ok, true);
  assert.equal(ok({ steps: { link_zwift_id_channel: { sentAt: ago(3) } } }).reason, "recent_dm");
  assert.equal(ok({ lastBotDmAt: ago(2) }).reason, "recent_dm");
  assert.equal(ok({ steps: { link_zwift_id_channel: { sentAt: ago(8) } } }).ok, true);
  assert.equal(ok({ reminders: { connect_intervals: { lastAt: ago(10), count: 1 } } }).reason, "recent_reminder");
  assert.equal(ok({ reminders: { join_companion: { lastAt: ago(30), count: 3 } } }).reason, "max_per_step");
  assert.equal(ok({ reminders: { join_companion: { lastAt: ago(30), count: 1, snoozedAt: ago(29) } } }).reason, "snoozed");
  assert.equal(ok({ steps: { join: { dmFailedAt: ago(40) } } }).reason, "dms_closed");
  assert.equal(ok({ test: true }).reason, "test");
});

test("activity schedules one look 10-60 minutes later; only members still active are taken", () => {
  resetSchedule();
  const t0 = NOW.getTime();
  noteActivity("a", t0, () => 0); // 10 minutes
  noteActivity("b", t0, () => 1); // 60 minutes
  noteActivity("a", t0 + MIN, () => 1); // already scheduled: no second look
  assert.deepEqual(takeDue(t0 + 9 * MIN, CFG), []);
  assert.deepEqual(takeDue(t0 + 11 * MIN, CFG), ["a"]);
  // b went quiet: by the time its look is due, its last activity is an hour old.
  assert.deepEqual(takeDue(t0 + 61 * MIN, CFG), []);
  // a was looked at; more activity soon after does not schedule another look.
  noteActivity("a", t0 + 20 * MIN, () => 0);
  assert.deepEqual(takeDue(t0 + 40 * MIN, CFG), []);
});

function setup({ status, inCompanion = null, sendError = null } = {}) {
  resetSchedule();
  const db = fakeDb();
  const sent = [];
  let clock = NOW.getTime();
  const deps = {
    db,
    now: () => new Date(clock),
    getStatus: async () => status,
    inCompanion: async () => inCompanion,
    fetchUser: async (id) => ({ send: async (payload) => { if (sendError) throw sendError; sent.push({ id, payload }); } }),
  };
  return { db, sent, deps, advance: (ms) => { clock += ms; } };
}

const UNLINKED = { inServer: true, verified: false, nextStep: "link_zwift_id_channel" };

test("a due look sends the reminder with buttons and records it in the shared DM record", async () => {
  const { db, sent, deps, advance } = setup({ status: UNLINKED });
  noteActivity("42", NOW.getTime(), () => 0);
  advance(11 * MIN);
  const outcomes = await processDue(null, { deps });
  assert.deepEqual(outcomes, [{ id: "42", outcome: "sent:link_zwift_id_channel" }]);
  const ids = sent[0].payload.components[0].components.map((button) => button.data.custom_id);
  assert.deepEqual(ids, ["annrem:done:link_zwift_id_channel", "annrem:stop:link_zwift_id_channel"]);
  const doc = db.docs.get(`${COLLECTION}/42`);
  assert.equal(doc.reminders.link_zwift_id_channel.count, 1);
  assert.ok(doc.lastBotDmAt);
  assert.equal(db.docs.get("bot_state/dm_reminders_daily").count, 1);
});

test("nothing is sent while paused, or once the daily cap is reached", async () => {
  const paused = setup({ status: UNLINKED });
  paused.db.docs.set("bot_state/announcer", { paused: true });
  noteActivity("1", NOW.getTime(), () => 0);
  paused.advance(11 * MIN);
  assert.deepEqual(await processDue(null, { deps: paused.deps }), []);

  const capped = setup({ status: UNLINKED });
  capped.db.docs.set("bot_state/dm_reminders_daily", { dateKey: "2026-10-29", count: CFG.dailyCap });
  noteActivity("2", NOW.getTime(), () => 0);
  capped.advance(11 * MIN);
  assert.deepEqual(await processDue(null, { deps: capped.deps }), [{ id: "2", outcome: "not_due" }]);
  assert.equal(capped.sent.length, 0);
});

test("closed DMs are recorded so the member is not tried again", async () => {
  const { db, deps, advance } = setup({ status: UNLINKED, sendError: Object.assign(new Error("Cannot send"), { code: 50007 }) });
  noteActivity("7", NOW.getTime(), () => 0);
  advance(11 * MIN);
  assert.deepEqual(await processDue(null, { deps }), [{ id: "7", outcome: "dm_closed" }]);
  const doc = db.docs.get(`${COLLECTION}/7`);
  assert.ok(doc.reminders.link_zwift_id_channel.dmFailedAt);
  assert.equal(decideReminder(doc, "join_companion", NOW.getTime() + 60 * DAY, CFG).reason, "dms_closed");
});

test("a member found in the Companion club after a reminder is counted as converted", async () => {
  const status = { inServer: true, verified: true, zwiftId: "123", nextStep: "done" };
  const { db, deps, advance } = setup({ status, inCompanion: true });
  db.docs.set(`${COLLECTION}/9`, { reminders: { join_companion: { count: 1, lastAt: new Date(NOW.getTime() - 20 * DAY) } } });
  noteActivity("9", NOW.getTime(), () => 0);
  advance(11 * MIN);
  assert.deepEqual(await processDue(null, { deps }), [{ id: "9", outcome: "nothing_due" }]);
  assert.ok(db.docs.get(`${COLLECTION}/9`).companionJoinedAt);
});
