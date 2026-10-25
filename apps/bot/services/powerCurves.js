/**
 * Best-power curves for a date window, built from intervals.icu's per-activity curves.
 *
 * intervals.icu's /power-curves endpoint only takes named windows (28d, all, ...), so a curve for
 * "January to February" is the best value per duration across every ride in that range, taken
 * from /activity-power-curves. Pure functions, so the tests need no credentials.
 */

// Durations the coach compares. Enough to read sprint, anaerobic, VO2, threshold and endurance.
const CURVE_SECS = [5, 15, 30, 60, 120, 300, 600, 1200, 3600];

const MAX_WINDOWS = 4;

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** One window's curve: the best watts per duration, with the ride and date it came from. */
function bestPowerCurve(payload) {
  const secs = Array.isArray(payload?.secs) ? payload.secs : [];
  const rides = Array.isArray(payload?.curves) ? payload.curves : [];
  const points = [];
  secs.forEach((seconds, i) => {
    const s = positive(seconds);
    if (!s) return;
    let best = null;
    for (const ride of rides) {
      const watts = positive(Array.isArray(ride?.watts) ? ride.watts[i] : null);
      if (watts && (!best || watts > best.watts)) {
        const weight = positive(ride.weight);
        best = {
          seconds: s,
          watts: Math.round(watts),
          w_per_kg: weight ? Math.round((watts / weight) * 100) / 100 : null,
          date: String(ride.start_date_local || "").slice(0, 10) || null,
          activity_id: ride.id != null ? String(ride.id) : null,
        };
      }
    }
    if (best) points.push(best);
  });
  return { rides: rides.length, points };
}

module.exports = { CURVE_SECS, MAX_WINDOWS, bestPowerCurve };
