/**
 * Category A of It's always a race. Category B is the route of the week, not this list.
 * Dates are YYYY-MM-DD. An override is a route id for one date.
 */

const { parseIsoDate, weeksBetween } = require("./seriesRotation");

function groupRideRoute(routes, anchorDate, anchorIndex, overrides, date) {
  const list = Array.isArray(routes) ? routes : [];
  if (!list.length) return null;
  const iso = parseIsoDate(date);
  if (!iso || !parseIsoDate(anchorDate)) return null;
  const override = overrides && overrides[iso];
  if (override) {
    const found = list.find((route) => Number(route.routeId) === Number(override));
    if (found) return found;
  }
  const index = (Number(anchorIndex) + weeksBetween(anchorDate, iso)) % list.length;
  return list[(index + list.length) % list.length];
}

module.exports = { groupRideRoute };
