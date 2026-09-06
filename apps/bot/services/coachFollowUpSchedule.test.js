const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldRunFollowUpSweep,
  isFollowUpDue,
  FOLLOW_UP_HOUR,
} = require("./coachFollowUpSchedule");

// Copenhagen is UTC+2 in September, so 06:00Z is 08:00 local.
const utc = (iso) => new Date(iso);

test("does not run before the check-in hour", () => {
  const r = shouldRunFollowUpSweep({ now: utc("2026-09-07T05:00:00Z"), lastRunDate: null });
  assert.equal(r.run, false);
  assert.equal(r.reason, "not_time");
});

test("runs on the first tick at or after the check-in hour", () => {
  const onTheHour = shouldRunFollowUpSweep({ now: utc("2026-09-07T06:00:00Z"), lastRunDate: null });
  assert.equal(onTheHour.run, true);
  assert.equal(onTheHour.todayKey, "2026-09-07");
});

test("a missed tick no longer skips the whole day", () => {
  // The old implementation required minute === 0 exactly, so a slow or missed tick at 08:00
  // silently dropped every check-in until the next morning.
  const late = shouldRunFollowUpSweep({ now: utc("2026-09-07T06:43:00Z"), lastRunDate: null });
  assert.equal(late.run, true, "08:43 local should still catch up");
});

test("only runs once per calendar day", () => {
  const r = shouldRunFollowUpSweep({ now: utc("2026-09-07T07:00:00Z"), lastRunDate: "2026-09-07" });
  assert.equal(r.run, false);
  assert.equal(r.reason, "already_ran");
});

test("does not fire check-ins late in the day", () => {
  // A bot restarting in the evening must not send a batch of morning nudges at 23:00.
  const evening = shouldRunFollowUpSweep({ now: utc("2026-09-07T21:00:00Z"), lastRunDate: null });
  assert.equal(evening.run, false);
  assert.equal(evening.reason, "too_late");
});

test("the window survives DST, when the UTC offset shifts", () => {
  // Copenhagen is UTC+1 in December, so 07:00Z is 08:00 local.
  const winter = shouldRunFollowUpSweep({ now: utc("2026-12-07T07:00:00Z"), lastRunDate: null });
  assert.equal(winter.run, true);
  // ...and 06:00Z is only 07:00 local, still too early.
  const tooEarly = shouldRunFollowUpSweep({ now: utc("2026-12-07T06:00:00Z"), lastRunDate: null });
  assert.equal(tooEarly.run, false);
  assert.equal(FOLLOW_UP_HOUR, 8);
});

test("check-ins are only due for the offered intervals", () => {
  const now = utc("2026-09-07T06:00:00Z");
  assert.equal(isFollowUpDue({ followUpEveryDays: null }, now), false, "opted out");
  assert.equal(isFollowUpDue({ followUpEveryDays: 5 }, now), false, "not an offered interval");
  assert.equal(isFollowUpDue({ followUpEveryDays: 7 }, now), true, "no contact recorded yet");
});

test("recent contact defers the check-in, by any of the three stamps", () => {
  const now = utc("2026-09-07T06:00:00Z");
  const recent = "2026-09-06T10:00:00.000Z";
  const old = "2026-08-01T10:00:00.000Z";

  assert.equal(isFollowUpDue({ followUpEveryDays: 7, lastAthleteMessageAt: recent }, now), false);
  assert.equal(isFollowUpDue({ followUpEveryDays: 7, lastFollowUpAt: recent }, now), false);
  assert.equal(isFollowUpDue({ followUpEveryDays: 7, updatedAt: recent }, now), false);

  assert.equal(isFollowUpDue({ followUpEveryDays: 7, lastAthleteMessageAt: old }, now), true);
  assert.equal(
    isFollowUpDue({ followUpEveryDays: 7, lastAthleteMessageAt: old, lastFollowUpAt: recent }, now),
    false,
    "the most recent stamp wins"
  );
});

test("a three-day cadence fires sooner than a fourteen-day one", () => {
  const now = utc("2026-09-07T06:00:00Z");
  const fiveDaysAgo = "2026-09-02T06:00:00.000Z";
  assert.equal(isFollowUpDue({ followUpEveryDays: 3, lastAthleteMessageAt: fiveDaysAgo }, now), true);
  assert.equal(isFollowUpDue({ followUpEveryDays: 14, lastAthleteMessageAt: fiveDaysAgo }, now), false);
});
