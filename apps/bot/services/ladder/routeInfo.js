const { lookupRoute } = require("./ladderRoutes");

// Same thresholds as the ZwiftEventViewer route classification (metres of climbing per km).
function classify(elevPerKm) {
  if (elevPerKm < 5) return "Flad";
  if (elevPerKm < 12) return "Let kuperet";
  if (elevPerKm < 25) return "Kuperet";
  return "Bjergrig";
}

// Returns total distance/elevation incl. lead-in and laps (or up to a fixed distance in metres), or null for unknown routes.
function describeRoute(routeName, laps, distanceM = null) {
  const route = routeName ? lookupRoute(null, routeName) : null;
  if (!route) return null;
  let lapCount = laps || 1;
  if (distanceM) lapCount = route.distKm > 0 ? Math.max(distanceM / 1000 - (route.leadInKm || 0), 0) / route.distKm : 0;
  const distKm = distanceM ? distanceM / 1000 : (route.leadInKm || 0) + route.distKm * lapCount;
  const elevM = (route.leadInElevM || 0) + route.elevM * lapCount;
  return { distKm, elevM, kind: classify(distKm > 0 ? elevM / distKm : 0) };
}

module.exports = { describeRoute };
