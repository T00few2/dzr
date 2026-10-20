/**
 * Pure arithmetic for route profile images. The drawing layer (routeProfileChart.js) needs the
 * native `canvas` module, which CI cannot build, so everything testable lives here.
 *
 * Input is the JSON the site's /api/route-profile returns (buildRaceProfile in
 * packages/shared/routeProfile.js), so the bot draws exactly the profile the site shows.
 * Colours match components/route-profile/RouteProfilePreview.tsx.
 */

const SEGMENT_COLORS = { sprint: "#56A845", climb: "#ed2324", segment: "#718096" };
const GRADE_BANDS = [
  { label: "<4%", max: 4, color: "#3CB44A" },
  { label: "4–7%", max: 7, color: "#2E6BFF" },
  { label: "7–10%", max: 10, color: "#E10600" },
  { label: "10%+", max: Infinity, color: "#111111" },
];

function gradeColor(grade) {
  return (GRADE_BANDS.find((band) => grade < band.max) || GRADE_BANDS[GRADE_BANDS.length - 1]).color;
}

/** Altitude at a distance, linearly interpolated. */
function altitudeAt(distanceKm, altitudeM, km) {
  const n = Math.min(distanceKm.length, altitudeM.length);
  if (!n) return 0;
  if (km <= distanceKm[0]) return altitudeM[0];
  for (let i = 1; i < n; i += 1) {
    if (km <= distanceKm[i]) {
      const span = distanceKm[i] - distanceKm[i - 1];
      const along = span > 0 ? (km - distanceKm[i - 1]) / span : 0;
      return altitudeM[i - 1] + along * (altitudeM[i] - altitudeM[i - 1]);
    }
  }
  return altitudeM[n - 1];
}

/**
 * Split [fromKm, toKm] into bins of about `binKm` and give each its average gradient, the way
 * climb close-ups are usually drawn. The bin size adapts so a long climb does not get hundreds of
 * slivers.
 */
function gradeBins(distanceKm, altitudeM, fromKm, toKm, { maxBins = 40, minBinKm = 0.1 } = {}) {
  const length = toKm - fromKm;
  if (!(length > 0)) return [];
  const binKm = Math.max(minBinKm, length / maxBins);
  const count = Math.max(1, Math.round(length / binKm));
  const size = length / count;
  const bins = [];
  for (let i = 0; i < count; i += 1) {
    const from = fromKm + i * size;
    const to = from + size;
    const altFrom = altitudeAt(distanceKm, altitudeM, from);
    const altTo = altitudeAt(distanceKm, altitudeM, to);
    const grade = ((altTo - altFrom) / (size * 1000)) * 100;
    bins.push({ fromKm: from, toKm: to, altFrom, altTo, grade, color: gradeColor(grade) });
  }
  return bins;
}

/** Summary line numbers for a stretch: length, gain, average and steepest bin gradient. */
function stretchStats(bins) {
  if (!bins.length) return { lengthKm: 0, gainM: 0, avgGrade: 0, maxGrade: 0 };
  const lengthKm = bins[bins.length - 1].toKm - bins[0].fromKm;
  const gainM = bins.reduce((sum, bin) => sum + Math.max(0, bin.altTo - bin.altFrom), 0);
  const net = bins[bins.length - 1].altTo - bins[0].altFrom;
  return {
    lengthKm,
    gainM,
    avgGrade: lengthKm > 0 ? (net / (lengthKm * 1000)) * 100 : 0,
    maxGrade: Math.max(...bins.map((bin) => bin.grade)),
  };
}

/** Total climbing over a profile, summing only the rises. */
function totalGainM(altitudeM) {
  let gain = 0;
  for (let i = 1; i < (altitudeM || []).length; i += 1) gain += Math.max(0, altitudeM[i] - altitudeM[i - 1]);
  return gain;
}

/** Round, evenly spaced axis ticks covering [min, max]. */
function niceTicks(min, max, target = 6) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => span / s <= target) || 10 * power;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/**
 * Climbs and sprints to band on the full profile. Plain segments are skipped: on a long race they
 * clutter the picture, and the site leaves them out too.
 */
function profileBands(segments) {
  return (Array.isArray(segments) ? segments : [])
    .filter((s) => s && (s.type === "climb" || s.type === "sprint") && s.toKm > s.fromKm)
    .map((s) => ({ name: s.name, type: s.type, fromKm: s.fromKm, toKm: s.toKm, color: SEGMENT_COLORS[s.type] }));
}

/**
 * Close-up windows. Named climbs come back matched from the site's API (profile.climbs); with
 * none named, every distinct climb on the first lap gets one, padded the way the site pads them.
 */
function zoomWindows(profile, { max = 3 } = {}) {
  const named = (profile?.climbs || []).filter((zoom) => zoom.matched && zoom.toKm > zoom.fromKm);
  if (named.length) return named.slice(0, max);
  const raceKm = Number(profile?.raceKm) || Infinity;
  const seen = new Set();
  const windows = [];
  for (const segment of profile?.segments || []) {
    if (segment.type !== "climb" || seen.has(segment.name)) continue;
    seen.add(segment.name);
    const fromKm = Math.max(0, segment.fromKm - 0.15);
    const toKm = Math.min(raceKm, segment.toKm + 0.08);
    if (toKm > fromKm) windows.push({ title: segment.name, fromKm, toKm, climb: true, matched: true });
    if (windows.length >= max) break;
  }
  return windows;
}

/**
 * The climb segment a close-up window was drawn around: the longest climb lying inside the window.
 * Stats come from it rather than the padded window, so the run-out past the banner (and, on
 * point-to-point routes, the stream jumping back to the start) does not skew the average.
 */
function zoomSegment(profile, zoom) {
  const inside = (profile?.segments || []).filter(
    (s) => s.type === "climb" && s.fromKm >= zoom.fromKm - 1e-6 && s.toKm <= zoom.toKm + 1e-6
  );
  if (!inside.length) return { fromKm: zoom.fromKm, toKm: zoom.toKm };
  return inside.reduce((best, s) => (s.toKm - s.fromKm > best.toKm - best.fromKm ? s : best));
}

module.exports = {
  SEGMENT_COLORS,
  zoomSegment,
  GRADE_BANDS,
  gradeColor,
  altitudeAt,
  gradeBins,
  stretchStats,
  totalGainM,
  niceTicks,
  profileBands,
  zoomWindows,
};
