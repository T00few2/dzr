/**
 * Zwift routes, segments and worlds from the zwift-data package, for DZR Helper.
 *
 * Local and free, so route questions need no web search. The package is a snapshot (see its
 * version in package.json): a route Zwift released after it will be missing, and the helper is
 * told to fall back to the web then.
 */
const zwiftData = require("zwift-data");

const MAX_RESULTS = 15;

/** Same folding as packages/shared/zwiftRouteMatch: "Sukis Playground" finds "Suki's Playground". */
function fold(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/\+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function createZwiftRoutes(data = zwiftData) {
  const worldName = new Map((data.worlds || []).map((w) => [w.slug, w.name]));
  const segmentBySlug = new Map((data.segments || []).map((s) => [s.slug, s]));

  function findWorld(query) {
    const wanted = fold(query);
    if (!wanted) return null;
    const world = (data.worlds || []).find((w) => fold(w.name) === wanted || w.slug === wanted.replace(/ /g, "-"));
    return world ? world.slug : undefined;
  }

  function routeSummary(route) {
    return {
      name: route.name,
      world: worldName.get(route.world) || route.world,
      distance_km: round(route.distance),
      elevation_m: round(route.elevation, 0),
      lead_in_km: round(route.leadInDistance),
      event_only: route.eventOnly === true || undefined,
      sports: Array.isArray(route.sports) && route.sports.length === 1 ? route.sports : undefined,
    };
  }

  /** Best matches by name: exact, then starts-with, then contains. */
  function matchByName(list, query) {
    const wanted = fold(query);
    if (!wanted) return list;
    const exact = list.filter((item) => fold(item.name) === wanted);
    if (exact.length) return exact;
    const starts = list.filter((item) => fold(item.name).startsWith(wanted));
    const contains = list.filter((item) => !starts.includes(item) && fold(item.name).includes(wanted));
    return [...starts, ...contains];
  }

  function searchRoutes({
    query = "",
    world = "",
    min_km,
    max_km,
    min_elevation,
    max_elevation,
    sport = "cycling",
    include_event_only = true,
    limit = 10,
  } = {}) {
    let list = data.routes || [];
    if (world) {
      const slug = findWorld(world);
      if (slug === undefined) {
        return { success: false, message: `Unknown world '${world}'.`, worlds: Array.from(worldName.values()) };
      }
      list = list.filter((r) => r.world === slug);
    }
    if (sport) list = list.filter((r) => !Array.isArray(r.sports) || r.sports.includes(sport));
    if (!include_event_only) list = list.filter((r) => r.eventOnly !== true);
    const inRange = (value, lo, hi) =>
      (lo === undefined || lo === null || value >= Number(lo)) && (hi === undefined || hi === null || value <= Number(hi));
    list = list.filter((r) => inRange(r.distance, min_km, max_km) && inRange(r.elevation, min_elevation, max_elevation));
    list = matchByName(list, query);
    if (!query) list = [...list].sort((a, b) => a.distance - b.distance);

    const n = Math.min(MAX_RESULTS, Math.max(1, Number(limit) || 10));
    return {
      success: true,
      total_matches: list.length,
      routes: list.slice(0, n).map(routeSummary),
      message: list.length ? undefined : "No route in zwift-data matched. It may be newer than the package; try the web.",
    };
  }

  function routeDetails(name) {
    const hits = matchByName(data.routes || [], name);
    if (!hits.length) {
      return { success: false, message: `No route named '${name}' in zwift-data. It may be newer than the package; try the web.` };
    }
    if (hits.length > 1 && fold(hits[0].name) !== fold(name)) {
      return { success: false, message: "Several routes match; pick one.", candidates: hits.slice(0, 8).map((r) => r.name) };
    }
    const route = hits[0];
    return {
      success: true,
      route: {
        ...routeSummary(route),
        lead_in_elevation_m: round(route.leadInElevation, 0),
        lead_in_free_ride_km: round(route.leadInDistanceFreeRide),
        lap_route: route.lap === true,
        level_locked: route.levelLocked === true,
        supports_tt: route.supportsTT === true,
        xp: route.experience ?? null,
        segments_on_route: (route.segmentsOnRoute || []).map((s) => {
          const segment = segmentBySlug.get(s.segment);
          return {
            name: segment?.name || s.segment,
            type: segment?.type || null,
            from_km: round(s.from, 2),
            to_km: round(s.to, 2),
          };
        }),
        // Segments the route touches without a recorded position, e.g. a sprint on a lap.
        other_segments: (route.segments || [])
          .filter((slug) => !(route.segmentsOnRoute || []).some((s) => s.segment === slug))
          .map((slug) => segmentBySlug.get(slug)?.name || slug),
        links: {
          zwift_insider: route.zwiftInsiderUrl || null,
          whats_on_zwift: route.whatsOnZwiftUrl || null,
          strava_segment: route.stravaSegmentUrl || null,
        },
      },
    };
  }

  function searchSegments({ query = "", world = "", type = "", limit = 10 } = {}) {
    let list = data.segments || [];
    if (world) {
      const slug = findWorld(world);
      if (slug === undefined) {
        return { success: false, message: `Unknown world '${world}'.`, worlds: Array.from(worldName.values()) };
      }
      list = list.filter((s) => s.world === slug);
    }
    if (type) list = list.filter((s) => s.type === String(type).toLowerCase());
    list = matchByName(list, query);
    const n = Math.min(MAX_RESULTS, Math.max(1, Number(limit) || 10));
    return {
      success: true,
      total_matches: list.length,
      segments: list.slice(0, n).map((s) => {
        const routes = (data.routes || []).filter((r) => (r.segments || []).includes(s.slug));
        return {
          name: s.name,
          type: s.type,
          world: worldName.get(s.world) || s.world,
          distance_km: round(s.distance, 2),
          elevation_m: round(s.elevation, 0) ?? undefined,
          avg_incline_pct: s.avgIncline ?? undefined,
          routes_with_it: routes.length,
          example_routes: routes.slice(0, 5).map((r) => r.name),
        };
      }),
    };
  }

  return { searchRoutes, routeDetails, searchSegments };
}

// Shared by the club bot and DZR Helper. Local and instant, so the club bot calls them itself
// instead of asking the helper.
const zwiftRouteToolDefinitions = [
  {
    type: "function",
    function: {
      name: "zwift_routes",
      description: "Search and filter Zwift routes by name, world, distance and elevation. Returns name, world, km, elevation and lead-in. With no query, sorted shortest first.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of the route name, e.g. 'tempus' or 'Road to Sky'." },
          world: { type: "string", description: "World name, e.g. 'Watopia', 'Makuri Islands', 'France'." },
          min_km: { type: "number" },
          max_km: { type: "number" },
          min_elevation: { type: "number", description: "Metres." },
          max_elevation: { type: "number", description: "Metres." },
          include_event_only: { type: "boolean", description: "Include event-only routes. Default true." },
          limit: { type: "number", description: "1-15. Default 10." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "zwift_route_details",
      description: "One Zwift route in detail: distance, elevation, lead-in, climbs/sprints/segments along it with km positions, lap/TT/level-lock flags, XP and links.",
      parameters: {
        type: "object",
        properties: { route: { type: "string", description: "Route name." } },
        required: ["route"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "zwift_segments",
      description: "Search Zwift climbs, sprints and segments by name, world or type. Returns length, elevation, gradient and routes that include it.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of the segment name, e.g. 'Alpe' or 'Epic KOM'." },
          world: { type: "string" },
          type: { type: "string", enum: ["climb", "sprint", "segment"] },
          limit: { type: "number", description: "1-15. Default 10." },
        },
      },
    },
  },
];

const ZWIFT_ROUTE_TOOLS = new Set(zwiftRouteToolDefinitions.map((tool) => tool.function.name));

function runZwiftRouteTool(name, args = {}, routes = defaultRoutes) {
  if (name === "zwift_routes") return routes.searchRoutes(args);
  if (name === "zwift_route_details") return routes.routeDetails(args.route);
  if (name === "zwift_segments") return routes.searchSegments(args);
  return { success: false, message: `Unknown tool ${name}.` };
}

const defaultRoutes = createZwiftRoutes();

module.exports = {
  createZwiftRoutes,
  ...defaultRoutes,
  zwiftRouteToolDefinitions,
  ZWIFT_ROUTE_TOOLS,
  runZwiftRouteTool,
};
