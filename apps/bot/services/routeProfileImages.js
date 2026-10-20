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

function facts(profile, world, laps) {
  const parts = [world, `${Number(profile.raceKm).toFixed(1)} km`, `${Math.round(totalGainM(profile.altitudeM))} m`];
  if (laps > 1) parts.push(`${laps} laps`);
  if (profile.leadInKm > 0) parts.push(`incl. ${Number(profile.leadInKm).toFixed(1)} km lead-in`);
  return parts.join(" · ");
}

/**
 * args: { route, world?, laps?, climbs?: string[], closeups?: boolean }
 * Returns { success, files: [{ name, buffer }], caption } or { success:false, message }.
 */
async function buildRouteProfileImages(args = {}, deps = {}) {
  const render = deps.render || require("./routeProfileChart");
  const fetchProfile = deps.getRouteProfile || getRouteProfile;

  const resolved = resolveRoute(String(args.route || "").trim(), String(args.world || "").trim());
  if (!resolved.success) return { success: false, message: resolved.message, candidates: resolved.candidates };

  const laps = Math.max(1, Math.min(20, Number.parseInt(args.laps, 10) || 1));
  const climbs = Array.isArray(args.climbs) ? args.climbs.filter(Boolean).slice(0, MAX_CLOSEUPS) : [];
  const loaded = await fetchProfile({ world: resolved.world, route: resolved.name, laps, climbs });
  if (!loaded.success) return { success: false, message: loaded.message };
  const profile = loaded.profile;

  const details = facts(profile, resolved.world, laps);
  const text = `**${resolved.name}** · ${details}`;
  const main = render.renderRouteProfile(profile, { name: resolved.name, subtitle: details });
  if (!main) return { success: false, message: "Could not draw the profile image." };
  const files = [{ name: `${fileSlug(resolved.name)}-profile.png`, buffer: main }];

  const missing = [];
  if (climbs.length || args.closeups === true) {
    for (const zoom of zoomWindows(profile, { max: MAX_CLOSEUPS })) {
      const png = render.renderClimbZoom(profile, zoom);
      if (png) files.push({ name: `${fileSlug(zoom.title)}-closeup.png`, buffer: png });
    }
    for (const zoom of profile.climbs || []) if (!zoom.matched) missing.push(zoom.title);
    if (!climbs.length && files.length === 1) missing.push("(no climbs on this route)");
  }

  return { success: true, files, caption: text, missing };
}

module.exports = { buildRouteProfileImages, resolveRoute };
