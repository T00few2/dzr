const { resolvePowerupId } = require("../powerupIcons");

function bagIds(fixture) {
  const fromIds = (fixture?.powerupIds || []).map(resolvePowerupId).filter((id) => id != null);
  if (fromIds.length) return fromIds;
  return (fixture?.powerups || []).map(resolvePowerupId).filter((id) => id != null);
}

function put(groups, km, ids, replace) {
  const known = (ids || []).filter((id) => Number.isInteger(id));
  if (!(Number(km) >= 0) || !known.length) return;
  const key = Number(km).toFixed(3);
  if (!groups.has(key) || replace) groups.set(key, { atKm: Number(km), powerupIds: [] });
  const row = groups.get(key);
  if (replace) row.powerupIds = [];
  for (const id of known) if (!row.powerupIds.includes(id)) row.powerupIds.push(id);
  if (!row.powerupIds.length) groups.delete(key);
}

// Bag on every sprint and climb banner. arch_powerup replaces one arch.
// Arch 0 is the lap banner: the end of the lead-in, then once per lap.
function placePowerups(profile, fixture) {
  if (!profile) return [];
  const bag = bagIds(fixture);
  const arch = fixture?.archPowerups || {};
  const groups = new Map();

  for (const segment of profile.segments || []) {
    if (segment.type !== "sprint" && segment.type !== "climb") continue;
    const override = segment.archId != null ? resolvePowerupId(arch[String(segment.archId)]) : null;
    put(groups, segment.toKm, override != null ? [override] : bag, override != null);
  }

  const lead = Number(profile.leadInKm) || 0;
  const lap = Number(profile.lapKm) || 0;
  const race = Number(profile.raceKm) || 0;
  const points = [lead];
  if (lap > 0) {
    for (let km = lead + lap; km < race - 0.05; km += lap) points.push(km);
  }
  const arch0 = resolvePowerupId(arch["0"]);
  for (const km of points) {
    if (arch0 != null) put(groups, km, [arch0], true);
    else put(groups, km, bag, false);
  }

  return [...groups.values()];
}

module.exports = { placePowerups };
