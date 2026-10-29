const test = require("node:test");
const assert = require("node:assert/strict");
const { canPostNow, localParts, isCoolingDown } = require("./pacing");
const { DEFAULTS, mergeSettings } = require("./settings");

// 12:00 in Copenhagen (UTC+1 in late October after DST ends on the 25th).
const NOON = new Date("2026-10-29T11:00:00Z");
const HOUR = 60 * 60 * 1000;
const base = { now: NOON, settings: DEFAULTS, state: {}, lastChannelMessageAt: NOON.getTime() - 48 * HOUR, adminPostedToday: false };

test("localParts gives the Copenhagen date and hour", () => {
  assert.deepEqual(localParts(NOON, "Europe/Copenhagen"), { dateKey: "2026-10-29", hour: 12, minute: 0 });
  assert.equal(localParts(new Date("2026-10-29T23:30:00Z"), "Europe/Copenhagen").dateKey, "2026-10-30");
});

test("a quiet channel inside the window may be posted to", () => {
  assert.deepEqual(canPostNow(base), { ok: true });
});

test("paused, disabled and outside the window are refused", () => {
  assert.equal(canPostNow({ ...base, state: { paused: true } }).reason, "paused");
  assert.equal(canPostNow({ ...base, settings: { ...DEFAULTS, enabled: false } }).reason, "paused");
  assert.equal(canPostNow({ ...base, now: new Date("2026-10-29T06:00:00Z") }).reason, "outside_window");
  assert.equal(canPostNow({ ...base, now: new Date("2026-10-29T19:30:00Z") }).reason, "outside_window");
});

test("the daily and weekly caps count the announcer's own posts", () => {
  const today = { at: new Date(NOON.getTime() - 2 * HOUR) };
  assert.equal(canPostNow({ ...base, state: { published: [today] } }).reason, "daily_cap");
  const week = [1, 2, 3].map((days) => ({ at: new Date(NOON.getTime() - days * 24 * HOUR) }));
  assert.equal(canPostNow({ ...base, state: { published: week } }).reason, "weekly_cap");
  const old = [8, 9, 10].map((days) => ({ at: new Date(NOON.getTime() - days * 24 * HOUR) }));
  assert.equal(canPostNow({ ...base, state: { published: old } }).ok, true);
});

test("an admin post today and a recent message in the channel both hold the post back", () => {
  assert.equal(canPostNow({ ...base, adminPostedToday: true }).reason, "admin_posted_today");
  assert.equal(canPostNow({ ...base, lastChannelMessageAt: NOON.getTime() - 3 * HOUR }).reason, "channel_busy");
  assert.equal(canPostNow({ ...base, lastChannelMessageAt: null }).ok, true);
});

test("cooldowns accept Dates, ISO strings and Firestore timestamps", () => {
  const twoDaysAgo = NOON.getTime() - 48 * HOUR;
  assert.equal(isCoolingDown(new Date(twoDaysAgo), 3, NOON), true);
  assert.equal(isCoolingDown(new Date(twoDaysAgo).toISOString(), 1, NOON), false);
  assert.equal(isCoolingDown({ toMillis: () => twoDaysAgo }, 3, NOON), true);
  assert.equal(isCoolingDown(undefined, 3, NOON), false);
});

test("stored settings override defaults field by field", () => {
  const merged = mergeSettings(DEFAULTS, { weeklyCap: 2, signals: { evergreen: { enabled: false } } });
  assert.equal(merged.weeklyCap, 2);
  assert.equal(merged.signals.evergreen.enabled, false);
  assert.equal(merged.signals.evergreen.cooldownDays, DEFAULTS.signals.evergreen.cooldownDays);
  assert.equal(merged.signals.unlinkedZwiftId.minCount, DEFAULTS.signals.unlinkedZwiftId.minCount);
});
