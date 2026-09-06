const FOLLOW_UP_TZ = "Europe/Copenhagen";
const FOLLOW_UP_HOUR = 8;
// Upper bound on the catch-up window. Without it, a bot that restarts late in the day would fire
// the whole day's check-ins at, say, 23:00 — an unwelcome DM rather than a morning nudge.
const FOLLOW_UP_LATEST_HOUR = 11;
const FOLLOW_UP_INTERVALS = [3, 7, 14];

/**
 * Pure scheduling logic for coach check-ins.
 *
 * Kept separate from coachFollowUp.js because that module requires ./firebase, which initialises
 * the Firebase Admin SDK at import time — so nothing in it can be unit tested without credentials.
 */

function calendarDateInTz(now = new Date(), tz = FOLLOW_UP_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(now);
}

function localClock(now = new Date(), tz = FOLLOW_UP_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return { hour, minute };
}

/**
 * Should the sweep run on this tick?
 *
 * Previously this required hour === 8 && minute === 0 exactly, so a single missed or slow tick
 * — a deploy, a restart, a busy scheduler — skipped the entire day's check-ins silently. The
 * lastRunDate guard already makes the sweep idempotent, so the minute is unnecessary precision:
 * run on the first tick at or after 08:00 local, and at most once per calendar day.
 */
function shouldRunFollowUpSweep({ now = new Date(), lastRunDate = null } = {}) {
  const { hour } = localClock(now);
  if (!Number.isFinite(hour)) return { run: false, reason: "no_clock" };
  if (hour < FOLLOW_UP_HOUR) return { run: false, reason: "not_time" };
  if (hour >= FOLLOW_UP_LATEST_HOUR) return { run: false, reason: "too_late" };

  const todayKey = calendarDateInTz(now);
  if (lastRunDate === todayKey) return { run: false, reason: "already_ran", todayKey };
  return { run: true, todayKey };
}

function parseStamp(value) {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function lastContactMs(profile) {
  const stamps = [profile?.lastAthleteMessageAt, profile?.lastFollowUpAt, profile?.updatedAt]
    .map(parseStamp)
    .filter(Number.isFinite);
  return stamps.length ? Math.max(...stamps) : 0;
}

/** True when this athlete has opted into check-ins and has been quiet for long enough. */
function isFollowUpDue(profile, now = new Date()) {
  const days = Number(profile?.followUpEveryDays);
  if (!FOLLOW_UP_INTERVALS.includes(days)) return false;
  const last = lastContactMs(profile);
  if (!last) return true;
  return now.getTime() - last >= days * 86400000;
}

module.exports = {
  FOLLOW_UP_TZ,
  FOLLOW_UP_HOUR,
  FOLLOW_UP_LATEST_HOUR,
  FOLLOW_UP_INTERVALS,
  calendarDateInTz,
  localClock,
  shouldRunFollowUpSweep,
  isFollowUpDue,
  lastContactMs,
};
