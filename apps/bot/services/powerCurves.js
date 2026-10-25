/**
 * Best-power curves for date windows, read from intervals.icu's /power-curves endpoint.
 *
 * That endpoint takes a date range as a curve id (r.2026-01-01.2026-02-28), so all windows come
 * back in one call. /activity-power-curves would also work in principle, but intervals.icu
 * answers it with 403 for an OAuth token. Pure functions, so the tests need no credentials.
 */

// Durations the coach compares. Enough to read sprint, anaerobic, VO2, threshold and endurance.
const CURVE_SECS = [5, 15, 30, 60, 120, 300, 600, 1200, 3600];

const MAX_WINDOWS = 4;

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** intervals.icu's id for a date-range curve. */
function rangeCurveId(oldest, newest) {
  return `r.${oldest}.${newest}`;
}

/**
 * One window's curve at CURVE_SECS: watts, W/kg, and the ride and date each best came from.
 * `activities` is the response's id → activity map, used for the dates.
 */
function compactRangeCurve(curve, activities = {}) {
  const secs = Array.isArray(curve?.secs) ? curve.secs : [];
  const watts = Array.isArray(curve?.values) ? curve.values : Array.isArray(curve?.watts) ? curve.watts : [];
  const wkg = Array.isArray(curve?.watts_per_kg) ? curve.watts_per_kg : [];
  const ids = Array.isArray(curve?.activity_id) ? curve.activity_id : [];
  const points = [];
  for (const seconds of CURVE_SECS) {
    const i = secs.findIndex((s) => Number(s) === seconds);
    const w = i >= 0 ? positive(watts[i]) : null;
    if (!w) continue;
    const id = ids[i] != null ? String(ids[i]) : null;
    const perKg = positive(wkg[i]);
    points.push({
      seconds,
      watts: Math.round(w),
      w_per_kg: perKg ? Math.round(perKg * 100) / 100 : null,
      date: String((id && activities?.[id]?.start_date_local) || "").slice(0, 10) || null,
      activity_id: id,
    });
  }
  return points;
}

/** Match each requested window to its curve in the response, by id and else by position. */
function rangeCurves(data, windows) {
  const list = Array.isArray(data?.list) ? data.list : [];
  const activities = data?.activities && typeof data.activities === "object" ? data.activities : {};
  return windows.map((window, i) => {
    const id = rangeCurveId(window.oldest, window.newest);
    const curve = list.find((c) => c?.id === id) || list[i] || null;
    return { oldest: window.oldest, newest: window.newest, points: compactRangeCurve(curve, activities) };
  });
}

module.exports = { CURVE_SECS, MAX_WINDOWS, rangeCurveId, compactRangeCurve, rangeCurves };
