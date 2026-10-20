const { totalGainM } = require("../routeProfileGeometry");
const { getRouteProfile } = require("../routeProfileApi");

// Same thresholds as the ZwiftEventViewer route classification (metres of climbing per km).
function classify(elevPerKm) {
  if (elevPerKm < 5) return "Flad";
  if (elevPerKm < 12) return "Let kuperet";
  if (elevPerKm < 25) return "Kuperet";
  return "Bjergrig";
}

// Distance and climbing from the site profile (raceKm already includes the lead-in). Null when there is no profile.
function describeProfile(profile) {
  if (!profile || !(Number(profile.raceKm) > 0)) return null;
  const distKm = Number(profile.raceKm);
  const elevM = totalGainM(profile.altitudeM || []);
  return { distKm, elevM, kind: classify(distKm > 0 ? elevM / distKm : 0) };
}

async function loadMatchProfile(fixture, fetchProfile = getRouteProfile) {
  const route = String(fixture?.route || "").trim();
  if (!route) return null;
  const distanceKm = Number(fixture.distance) > 0 ? Number(fixture.distance) / 1000 : 0;
  const laps = distanceKm > 0 ? 1 : Math.max(1, Number(fixture.laps) || 1);
  const loaded = await fetchProfile({
    world: fixture.world || "",
    route,
    laps,
    distanceKm,
  });
  return loaded && loaded.success ? loaded.profile : null;
}

module.exports = { describeProfile, loadMatchProfile, classify };
