/**
 * Build the PNGs for a route profile request: the race profile, plus climb close-ups when asked.
 * Returns files and a caption; the caller posts them, so this has no Discord dependency.
 */
const { routeDetails, searchRoutes } = require("./zwiftRoutes");
const { getRouteProfile } = require("./routeProfileApi");
const { zoomWindows, totalGainM } = require("./routeProfileGeometry");

const MAX_CLOSEUPS = 3;

function fileSlug(value) {
  return String(value || "route").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "route";
}

/** The exact route name and world, from zwift-data, so the site API gets names it can match. */
function resolveRoute(route, world) {
  if (world) {
    const found = searchRoutes({ query: route, world, limit: 5 });
    if (!found.success) return found;
    if (!found.routes.length) return { success: false, message: `No route called '${route}' in ${world}.` };
    return { success: true, name: found.routes[0].name, world: found.routes[0].world };
  }
  const details = routeDetails(route);
  if (!details.success) return details;
  return { success: true, name: details.route.name, world: details.route.world };
}

/** Custom KOMs as the site expects them, dropping any that cannot be drawn. */
function customRanges(list) {
  return (Array.isArray(list) ? list : [])
    .map((kom) => ({
      name: String(kom?.name || "").trim().slice(0, 60) || "Custom KOM",
      fromKm: Number(kom?.from_km ?? kom?.fromKm),
      toKm: Number(kom?.to_km ?? kom?.toKm),
    }))
    .filter((kom) => Number.isFinite(kom.fromKm) && Number.isFinite(kom.toKm) && kom.toKm > kom.fromKm && kom.fromKm >= 0)
    .slice(0, MAX_CLOSEUPS);
}

/**
 * Close-up windows in the order asked: named climbs, then custom KOMs (marked exact, so their stats
 * cover exactly the given stretch), then the finish. With only `closeups`, every climb on the route.
 */
function closeupWindows(profile, nameCount) {
  const asked = (profile.climbs || []).map((zoom, index) => ({ ...zoom, exact: index >= nameCount }));
  const windows = asked.filter((zoom) => zoom.matched && zoom.toKm > zoom.fromKm);
  if (!asked.length) windows.push(...zoomWindows(profile, { max: MAX_CLOSEUPS }));
  const finish = profile.finish;
  if (finish?.matched && finish.toKm > finish.fromKm) windows.push({ ...finish, title: `Finish: ${finish.title}` });
  return {
    windows: windows.slice(0, MAX_CLOSEUPS + 1),
    missing: [...asked, ...(finish ? [finish] : [])].filter((zoom) => !zoom.matched).map((zoom) => zoom.title),
  };
}

function facts(profile, world, laps) {
  const parts = [world, `${Number(profile.raceKm).toFixed(1)} km`, `${Math.round(totalGainM(profile.altitudeM))} m`];
  if (laps > 1) parts.push(`${laps} laps`);
  if (profile.leadInKm > 0) parts.push(`incl. ${Number(profile.leadInKm).toFixed(1)} km lead-in`);
  return parts.join(" · ");
}

/**
 * args: { route, world?, laps?, distance_km?, climbs?: string[], custom_koms?: [{ name, from_km, to_km }],
 *         finish?, closeups?: boolean }
 * Returns { success, files: [{ name, buffer }], caption } or { success:false, message }.
 */
async function buildRouteProfileImages(args = {}, deps = {}) {
  const render = deps.render || require("./routeProfileChart");
  const fetchProfile = deps.getRouteProfile || getRouteProfile;

  const resolved = resolveRoute(String(args.route || "").trim(), String(args.world || "").trim());
  if (!resolved.success) return { success: false, message: resolved.message, candidates: resolved.candidates };

  const distanceKm = Number(args.distance_km) > 0 ? Number(args.distance_km) : 0;
  const laps = distanceKm ? 1 : Math.max(1, Math.min(20, Number.parseInt(args.laps, 10) || 1));
  const climbs = Array.isArray(args.climbs) ? args.climbs.filter(Boolean).slice(0, MAX_CLOSEUPS) : [];
  const ranges = customRanges(args.custom_koms);
  const finish = String(args.finish || "").trim();
  const loaded = await fetchProfile({ world: resolved.world, route: resolved.name, laps, distanceKm, climbs, ranges, finish });
  if (!loaded.success) return { success: false, message: loaded.message };
  const profile = loaded.profile;

  const details = facts(profile, resolved.world, laps);
  const text = `**${resolved.name}** · ${details}`;
  const main = render.renderRouteProfile(profile, { name: resolved.name, subtitle: details });
  if (!main) return { success: false, message: "Could not draw the profile image." };
  const files = [{ name: `${fileSlug(resolved.name)}-profile.png`, buffer: main }];

  const missing = [];
  if (climbs.length || ranges.length || finish || args.closeups === true) {
    const planned = closeupWindows(profile, climbs.length);
    for (const zoom of planned.windows) {
      const png = render.renderClimbZoom(profile, zoom);
      if (png) files.push({ name: `${fileSlug(zoom.title)}-closeup.png`, buffer: png });
    }
    missing.push(...planned.missing);
    if (args.closeups === true && !climbs.length && !ranges.length && !profile.segments?.some((s) => s.type === "climb")) {
      missing.push("(no climbs on this route)");
    }
  }

  return { success: true, files, caption: text, missing };
}

module.exports = { buildRouteProfileImages, resolveRoute, customRanges, closeupWindows };
