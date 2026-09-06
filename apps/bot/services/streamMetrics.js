/**
 * Derived metrics from Strava activity streams.
 *
 * Pure functions, no I/O and no imports, so this can be unit tested — the numbers here end up in
 * coaching advice, and a silently wrong power curve is the fastest way to lose a strong rider's
 * trust.
 *
 * Streams never reach the model. A two-hour ride is roughly 7,200 samples per stream; the whole
 * point is to reduce that to a handful of numbers here and send only those.
 */

/** Standard mean-maximal durations, in seconds. */
const MMP_DURATIONS = [5, 15, 30, 60, 300, 480, 720, 1200, 3600];

/**
 * Resample an irregularly-sampled stream onto a 1 Hz grid.
 *
 * Strava's "smart recording" does not sample every second — it records when values change, so
 * gaps of several seconds are normal. Treating the raw array as 1 Hz (its index as its timestamp)
 * silently compresses time and inflates every rolling-window metric: a 20-minute power computed
 * over what is really 35 minutes of riding. The `time` stream carries the true offsets, so use it.
 *
 * @param {number[]} timeStream Seconds from activity start, monotonically increasing.
 * @param {number[]} values Samples aligned to timeStream.
 * @param {"zero"|"hold"} fill How to fill gaps. Power coasts to zero; heart rate holds its
 *   previous value, because a gap in HR means "not recorded", not "no heartbeat".
 * @returns {number[]} One value per second, index = seconds from start.
 */
function resampleTo1Hz(timeStream, values, fill = "zero") {
  if (!Array.isArray(timeStream) || !Array.isArray(values) || timeStream.length === 0) return [];
  const n = Math.min(timeStream.length, values.length);
  if (n === 0) return [];

  const lastTime = Math.floor(Number(timeStream[n - 1]));
  if (!Number.isFinite(lastTime) || lastTime < 0) return [];
  // Guard against a corrupt stream claiming a 30-day ride.
  const duration = Math.min(lastTime, 24 * 3600);

  const out = new Array(duration + 1).fill(fill === "hold" ? null : 0);
  let previous = 0;

  for (let i = 0; i < n; i++) {
    const t = Math.floor(Number(timeStream[i]));
    if (!Number.isFinite(t) || t < 0 || t > duration) continue;
    const v = Number(values[i]);
    const value = Number.isFinite(v) ? v : previous;
    out[t] = value;
    previous = value;
  }

  if (fill === "hold") {
    let carry = null;
    for (let i = 0; i < out.length; i++) {
      if (out[i] == null) out[i] = carry;
      else carry = out[i];
    }
  }
  return out;
}

/** Rolling mean over `window` seconds, returned at each end-index. */
function rollingMean(series, window) {
  if (!Array.isArray(series) || window <= 0 || series.length < window) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += Number(series[i]) || 0;
    if (i >= window) sum -= Number(series[i - window]) || 0;
    if (i >= window - 1) out.push(sum / window);
  }
  return out;
}

/**
 * Best average power sustained for each duration — the mean-maximal curve.
 * Strava has no endpoint for this; it is derived from the watts stream.
 */
function meanMaxPower(watts1Hz, durations = MMP_DURATIONS) {
  const out = {};
  for (const duration of durations) {
    const means = rollingMean(watts1Hz, duration);
    out[duration] = means.length ? Math.round(Math.max(...means)) : null;
  }
  return out;
}

/**
 * Normalized power: 30-second rolling average, raised to the fourth power, averaged, fourth root.
 * Weights surges more heavily than a plain average, which is why it tracks perceived cost better.
 */
function normalizedPower(watts1Hz) {
  const rolled = rollingMean(watts1Hz, 30);
  if (rolled.length === 0) return null;
  const meanOfFourth = rolled.reduce((acc, w) => acc + Math.pow(Math.max(0, w), 4), 0) / rolled.length;
  return Math.round(Math.pow(meanOfFourth, 0.25));
}

/** Intensity factor: normalized power relative to threshold. */
function intensityFactor(np, ftp) {
  if (!np || !ftp || ftp <= 0) return null;
  return Number((np / ftp).toFixed(3));
}

/** Training stress for the session. 100 = an hour at threshold. */
function trainingStressScore(np, ftp, durationSeconds) {
  const intensity = intensityFactor(np, ftp);
  if (!intensity || !durationSeconds || durationSeconds <= 0) return null;
  return Math.round((durationSeconds * np * intensity) / (ftp * 3600) * 100);
}

/**
 * Aerobic decoupling: how far the power-to-heart-rate ratio drifts from the first half of a ride
 * to the second. Rising cardiac cost at the same power indicates fading durability. Conventionally
 * anything under about 5% is considered aerobically sound.
 *
 * Only meaningful for steady rides; returns null when either half lacks usable data.
 */
function aerobicDecoupling(watts1Hz, hr1Hz) {
  if (!Array.isArray(watts1Hz) || !Array.isArray(hr1Hz)) return null;
  const n = Math.min(watts1Hz.length, hr1Hz.length);
  if (n < 600) return null; // under ten minutes, drift is noise

  const half = Math.floor(n / 2);
  const efficiency = (from, to) => {
    let power = 0;
    let heart = 0;
    let count = 0;
    for (let i = from; i < to; i++) {
      const w = Number(watts1Hz[i]);
      const h = Number(hr1Hz[i]);
      if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) continue;
      power += w;
      heart += h;
      count += 1;
    }
    if (count < 60) return null;
    const avgHr = heart / count;
    return avgHr > 0 ? power / count / avgHr : null;
  };

  const first = efficiency(0, half);
  const second = efficiency(half, n);
  if (first == null || second == null || first === 0) return null;
  return Number((((first - second) / first) * 100).toFixed(1));
}

/**
 * Seconds spent in each power zone.
 * @param {number[]} boundaries Ascending upper bounds; the final zone is open-ended.
 */
function timeInZones(watts1Hz, boundaries) {
  if (!Array.isArray(watts1Hz) || !Array.isArray(boundaries) || boundaries.length === 0) return null;
  const counts = new Array(boundaries.length + 1).fill(0);
  for (const raw of watts1Hz) {
    const w = Number(raw);
    if (!Number.isFinite(w)) continue;
    let zone = boundaries.findIndex((upper) => w <= upper);
    if (zone === -1) zone = boundaries.length;
    counts[zone] += 1;
  }
  return counts;
}

/**
 * Detect work intervals: contiguous stretches above `thresholdWatts`.
 *
 * `minSeconds` discards surges too short to be a deliberate effort, and `bridgeSeconds` joins
 * blocks separated by a brief dip, so one interval with a momentary freewheel is not reported as
 * two.
 */
function detectIntervals(watts1Hz, { thresholdWatts, minSeconds = 30, bridgeSeconds = 10 } = {}) {
  if (!Array.isArray(watts1Hz) || !thresholdWatts || thresholdWatts <= 0) return [];

  const blocks = [];
  let start = null;
  let gap = 0;

  for (let i = 0; i < watts1Hz.length; i++) {
    const above = (Number(watts1Hz[i]) || 0) >= thresholdWatts;
    if (above) {
      if (start == null) start = i;
      gap = 0;
    } else if (start != null) {
      gap += 1;
      if (gap > bridgeSeconds) {
        blocks.push([start, i - gap]);
        start = null;
        gap = 0;
      }
    }
  }
  if (start != null) blocks.push([start, watts1Hz.length - 1]);

  return blocks
    .filter(([from, to]) => to - from + 1 >= minSeconds)
    .map(([from, to]) => {
      const slice = watts1Hz.slice(from, to + 1).map((w) => Number(w) || 0);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      return {
        startSeconds: from,
        durationSeconds: to - from + 1,
        averageWatts: Math.round(avg),
        peakWatts: Math.round(Math.max(...slice)),
      };
    });
}

module.exports = {
  MMP_DURATIONS,
  resampleTo1Hz,
  rollingMean,
  meanMaxPower,
  normalizedPower,
  intensityFactor,
  trainingStressScore,
  aerobicDecoupling,
  timeInZones,
  detectIntervals,
};
