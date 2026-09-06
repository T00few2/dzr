/**
 * Weekly training load rollups.
 *
 * getRecentActivities clamps to 28 days, so the coach could only ever see the last few weeks —
 * enough to report what happened, not enough to see a trend. Periodisation is about trend:
 * "you have built three weeks in a row, next week should be easy" is coaching; "you rode four
 * times last week" is reading the log back.
 *
 * Pure functions, no I/O, so the aggregation is unit tested. Weeks are ISO (Monday start) in
 * Europe/Copenhagen, matching formatCoachToday and the rest of the coach's date handling.
 */

const COACH_TZ = "Europe/Copenhagen";
const WEEKDAY_MON0 = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function calendarDateInTz(value, tz = COACH_TZ) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(date);
}

function addIsoDays(iso, days) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The Monday of the ISO week containing this instant, as YYYY-MM-DD. */
function weekStart(value, tz = COACH_TZ) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = calendarDateInTz(date, tz);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
  return addIsoDays(today, -(WEEKDAY_MON0[weekday] ?? 0));
}

/**
 * Session load.
 *
 * Uses TSS when both normalized-ish power and FTP are known. Falls back to duration scaled by a
 * nominal intensity otherwise, so a rider with no power meter still gets a usable trend — clearly
 * an estimate, and flagged as one so the coach does not present it as measured.
 */
function sessionLoad(activity, ftp) {
  const seconds = Number(activity?.moving_time) || 0;
  if (seconds <= 0) return { load: 0, estimated: true };

  const watts = Number(activity?.weighted_average_watts) || Number(activity?.average_watts) || 0;
  if (watts > 0 && ftp > 0) {
    const intensity = watts / ftp;
    return { load: Math.round((seconds / 3600) * intensity * intensity * 100), estimated: false };
  }
  // No power: assume a moderate endurance intensity rather than inventing a number.
  return { load: Math.round((seconds / 3600) * 50), estimated: true };
}

/**
 * Aggregate activities into weekly buckets.
 * @returns {Array<{week, sessions, hours, distanceKm, elevationM, load, estimated, indoorSessions}>}
 *   ascending by week.
 */
function rollupWeeks(activities, { ftp = null, weeks = 26, now = new Date() } = {}) {
  const buckets = new Map();

  for (const activity of Array.isArray(activities) ? activities : []) {
    const when = activity?.start_date || activity?.start_date_local;
    const week = weekStart(when);
    if (!week) continue;

    if (!buckets.has(week)) {
      buckets.set(week, {
        week,
        sessions: 0,
        hours: 0,
        distanceKm: 0,
        elevationM: 0,
        load: 0,
        estimated: false,
        indoorSessions: 0,
      });
    }
    const bucket = buckets.get(week);
    const { load, estimated } = sessionLoad(activity, ftp);
    bucket.sessions += 1;
    bucket.hours += (Number(activity?.moving_time) || 0) / 3600;
    bucket.distanceKm += (Number(activity?.distance_m) || 0) / 1000;
    bucket.elevationM += Number(activity?.elevation_gain_m) || 0;
    bucket.load += load;
    if (estimated) bucket.estimated = true;
    if (activity?.trainer || activity?.sport_type === "VirtualRide") bucket.indoorSessions += 1;
  }

  const cutoff = addIsoDays(weekStart(now), -7 * (weeks - 1));
  return Array.from(buckets.values())
    .filter((bucket) => bucket.week >= cutoff)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((bucket) => ({
      ...bucket,
      hours: Number(bucket.hours.toFixed(1)),
      distanceKm: Math.round(bucket.distanceKm),
      elevationM: Math.round(bucket.elevationM),
    }));
}

/**
 * Trend signals a coach actually acts on.
 *
 * rampPercent compares the most recent complete week against the mean of the four before it.
 * consecutiveBuildWeeks counts how many weeks in a row load has risen — the number behind
 * "you have built three weeks straight, next week should be easy".
 */
function loadTrend(weekly) {
  const rows = Array.isArray(weekly) ? weekly.filter((w) => w && w.week) : [];
  if (rows.length < 2) return { rampPercent: null, consecutiveBuildWeeks: 0, weeksWithoutRest: 0 };

  const latest = rows[rows.length - 1];
  const priorFour = rows.slice(Math.max(0, rows.length - 5), rows.length - 1);
  const baseline = priorFour.length
    ? priorFour.reduce((acc, w) => acc + (w.load || 0), 0) / priorFour.length
    : 0;
  const rampPercent = baseline > 0 ? Math.round(((latest.load - baseline) / baseline) * 100) : null;

  let consecutiveBuildWeeks = 0;
  for (let i = rows.length - 1; i > 0; i--) {
    if ((rows[i].load || 0) > (rows[i - 1].load || 0)) consecutiveBuildWeeks += 1;
    else break;
  }

  // A rest week is one meaningfully lighter than the week before it.
  let weeksWithoutRest = 0;
  for (let i = rows.length - 1; i > 0; i--) {
    if ((rows[i].load || 0) < (rows[i - 1].load || 0) * 0.75) break;
    weeksWithoutRest += 1;
  }

  return { rampPercent, consecutiveBuildWeeks, weeksWithoutRest };
}

/** Compact table for the system prompt. A few hundred tokens buys the whole trend. */
function formatWeeklyLoadForPrompt(weekly, trend) {
  const rows = Array.isArray(weekly) ? weekly.slice(-12) : [];
  if (!rows.length) return "No weekly history yet.";

  const lines = rows.map((w) => {
    const indoor = w.sessions > 0 ? ` ${w.indoorSessions}/${w.sessions} indoor` : "";
    return `- ${w.week}: ${w.sessions} sessions, ${w.hours}h, load ${w.load}${w.estimated ? "*" : ""}${indoor}`;
  });

  const notes = [];
  if (trend?.rampPercent != null) {
    notes.push(`Latest week is ${trend.rampPercent >= 0 ? "+" : ""}${trend.rampPercent}% against the prior four-week average.`);
  }
  if (trend?.consecutiveBuildWeeks >= 2) {
    notes.push(`Load has risen ${trend.consecutiveBuildWeeks} weeks in a row.`);
  }
  if (trend?.weeksWithoutRest >= 4) {
    notes.push(`${trend.weeksWithoutRest} weeks without a clear rest week.`);
  }
  if (rows.some((w) => w.estimated)) {
    notes.push("* load estimated from duration where no power data was recorded — treat as approximate.");
  }

  return [...lines, ...(notes.length ? ["", ...notes] : [])].join("\n");
}

module.exports = {
  COACH_TZ,
  weekStart,
  sessionLoad,
  rollupWeeks,
  loadTrend,
  formatWeeklyLoadForPrompt,
};
