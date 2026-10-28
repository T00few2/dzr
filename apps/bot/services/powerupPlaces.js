const { resolvePowerupId } = require("./powerupIcons");

// Zwift event tags carry the powerup setup, on the event API and copied onto the ladder page.
// Some organisers type curly quotes, so any straight or curly quote closes the value.
function tagValue(tag, name) {
  const m = String(tag).match(new RegExp(`${name}=["“”]([^"“”]+)["“”]`));
  return m ? m[1] : null;
}

// The powerup every rider starts with: starting_powerup=4 (no quotes).
function parseStartingPowerup(tags) {
  for (const tag of tags || []) {
    const m = String(tag).match(/^starting_powerup=(\d+)$/);
    if (m) return Number(m[1]);
  }
  return null;
}

// Per-arch powerup choices: arch_powerup="archId,powerupId,..." (archId -> powerupId).
function parseArchPowerups(tags) {
  const map = {};
  for (const tag of tags || []) {
    const value = tagValue(tag, "arch_powerup");
    if (!value) continue;
    const parts = value.split(",");
    for (let i = 0; i < parts.length - 1; i += 2) {
      const id = parseInt(parts[i + 1].trim(), 10);
      if (Number.isInteger(id)) map[parts[i].trim()] = id;
    }
  }
  return map;
}

// The random bag: powerup_percent="id,pct,id,pct,...". Ids are unique and keep first-seen order.
function parsePowerupPercent(tags) {
  const ids = [];
  for (const tag of tags || []) {
    const value = tagValue(tag, "powerup_percent");
    if (!value) continue;
    const parts = value.split(",");
    for (let i = 0; i < parts.length - 1; i += 2) {
      const id = parseInt(parts[i].trim(), 10);
      if (Number.isInteger(id) && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function bagIds(fixture) {
  const fromIds = (fixture?.powerupIds || []).map(resolvePowerupId).filter((id) => id != null);
  if (fromIds.length) return fromIds;
  return (fixture?.powerups || []).map(resolvePowerupId).filter((id) => id != null);
}

function altitudeAt(profile, km) {
  const distance = profile.distanceKm || [];
  const altitude = profile.altitudeM || [];
  if (distance.length < 2 || altitude.length < 2) return null;
  let index = 0;
  while (index < distance.length - 1 && distance[index + 1] < km) index += 1;
  const next = Math.min(index + 1, distance.length - 1);
  const span = distance[next] - distance[index];
  if (!(span > 0)) return altitude[index];
  const along = Math.min(1, Math.max(0, (km - distance[index]) / span));
  return altitude[index] + along * (altitude[next] - altitude[index]);
}

// A banner only pays out in one direction. Riding a climb downhill is the other direction.
function riddenUp(profile, segment) {
  if (segment.type !== "climb") return true;
  const from = altitudeAt(profile, segment.fromKm);
  const to = altitudeAt(profile, segment.toKm);
  if (from == null || to == null) return true;
  return to - from > 0;
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
    if (!riddenUp(profile, segment)) continue;
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

module.exports = { placePowerups, parseArchPowerups, parsePowerupPercent, parseStartingPowerup };
