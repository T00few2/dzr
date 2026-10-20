// Port of ladder.cycleracing.club/js/segmentUtils.js plus the route-path maths from its fixture page,
// so the bot can show the same elevation profile with segment and powerup markers.

function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ccw(A, B, C) {
  return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
}

function lineIntersection(A, B, C, D) {
  const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1];
  const a2 = D[1] - C[1], b2 = C[0] - D[0], c2 = a2 * C[0] + b2 * C[1];
  const det = a1 * b2 - a2 * b1;
  if (det === 0) return null;
  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
}

function intersect(A, B, C, D) {
  if (ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D)) return lineIntersection(A, B, C, D);
  return null;
}

function bannerIntersections(p1, p2, segment) {
  const a = [p1[0], p1[1]], b = [p2[0], p2[1]];
  const results = [];
  for (const [type, line] of [["banner", segment.latLon], ["forward", segment.forwardlatLon], ["reverse", segment.reverselatLon]]) {
    if (!line) continue;
    const point = intersect(a, b, line[0], line[1]);
    if (point) results.push({ type, point });
  }
  return results;
}

function findSegmentCrossings(path, distances, segments, worldId) {
  const map = new Map();
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i], p2 = path[i + 1];
    const d1 = distances[i], d2 = distances[i + 1];
    for (const segment of segments) {
      if (Number(segment.worldId) !== Number(worldId)) continue;
      for (const { type, point } of bannerIntersections(p1, p2, segment)) {
        if (!map.has(segment.id)) map.set(segment.id, { segment, crossings: [] });
        const ratio =
          Math.hypot(point[0] - p1[0], point[1] - p1[1]) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        map.get(segment.id).crossings.push({ type, dist: d1 + (d2 - d1) * ratio });
      }
    }
  }
  return map;
}

function pairSegmentCrossings(crossingsMap, distances) {
  const paired = [];

  crossingsMap.forEach(({ segment, crossings }) => {
    crossings.sort((a, b) => a.dist - b.dist);
    const consumed = new Set();
    const maxKnown = Math.max(segment.distanceForward || 0, segment.distanceReverse || 0);
    const maxGap = maxKnown > 0 ? maxKnown * 1.5 : 10000;

    for (let i = 0; i < crossings.length - 1; i++) {
      if (consumed.has(i)) continue;
      const curr = crossings[i], next = crossings[i + 1];
      if (next.dist - curr.dist > maxGap) continue;
      const isDir = (c) => c.type === "forward" || c.type === "reverse";
      if (isDir(curr) && next.type === "banner") {
        paired.push({ startDist: curr.dist, endDist: next.dist, type: curr.type, segment });
      } else if (curr.type === "banner" && isDir(next)) {
        paired.push({ startDist: curr.dist, endDist: next.dist, type: next.type, segment });
      } else {
        continue;
      }
      consumed.add(i);
      consumed.add(i + 1);
      i++;
    }
  });

  // Drop pairs that are unreasonably long compared to the segment's known length.
  for (let i = paired.length - 1; i >= 0; i--) {
    const pair = paired[i];
    const measured = pair.endDist - pair.startDist;
    const known = pair.type === "forward" ? pair.segment.distanceForward : pair.segment.distanceReverse;
    if (known > 0 && measured > known * 1.5) paired.splice(i, 1);
    else if (!known && measured > 10000) paired.splice(i, 1);
  }

  // Drop false positives: a longer pair that contains a shorter pair's timing line.
  for (let i = paired.length - 1; i >= 0; i--) {
    const pair = paired[i];
    const len = pair.endDist - pair.startDist;
    const invalidated = paired.some((other, j) => {
      if (i === j) return false;
      if (other.endDist - other.startDist >= len) return false;
      return (
        (other.startDist > pair.startDist && other.startDist < pair.endDist) ||
        (other.endDist > pair.startDist && other.endDist < pair.endDist)
      );
    });
    if (invalidated) paired.splice(i, 1);
  }

  // Extend the last unpaired timing line to the route end when that is plausible.
  const maxDist = distances[distances.length - 1];
  let lastUnpaired = null;
  crossingsMap.forEach(({ segment, crossings }) => {
    const last = crossings[crossings.length - 1];
    const used = paired.some((p) => p.segment === segment && (p.startDist === last.dist || p.endDist === last.dist));
    if (!used && (last.type === "forward" || last.type === "reverse") && (!lastUnpaired || last.dist > lastUnpaired.dist)) {
      lastUnpaired = { dist: last.dist, type: last.type, segment };
    }
  });
  if (lastUnpaired) {
    const lengths = paired.filter((p) => p.segment === lastUnpaired.segment).map((p) => p.endDist - p.startDist);
    const avgKnown = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : Infinity;
    if (maxDist - lastUnpaired.dist < avgKnown * 2 || lengths.length === 0) {
      paired.push({ startDist: lastUnpaired.dist, endDist: maxDist, type: lastUnpaired.type, segment: lastUnpaired.segment });
    }
  }

  const activeDirections = new Map();
  for (const pair of paired) {
    if (!activeDirections.has(pair.segment.id)) activeDirections.set(pair.segment.id, new Set());
    activeDirections.get(pair.segment.id).add(pair.type);
  }
  return { paired, activeDirections };
}

function pathLength(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

// Same interpolation as the ladder page: the part of a lap that fits in targetDistance metres.
function partialPath(lap, targetDistance) {
  let current = 0;
  const result = [lap[0]];
  for (let i = 1; i < lap.length; i++) {
    const seg = haversine(lap[i - 1], lap[i]);
    if (current + seg <= targetDistance) {
      result.push(lap[i]);
      current += seg;
    } else {
      const ratio = (targetDistance - current) / seg;
      result.push(lap[i - 1].map((v, k) => v + (lap[i][k] - v) * ratio));
      break;
    }
  }
  return result;
}

// Builds the profile and markers for a route path (from /path/{routeId}).
// Like the ladder page, a fixture is either a lap count or a fixed distance (metres) that ends mid-lap.
function buildRouteProfile(routeData, { laps = null, distance = null } = {}) {
  const path = [...routeData.leadIn];
  const lapRanges = []; // [firstPointIndex, lastPointIndex, partial]
  const addLap = (coords, partial) => {
    const first = path.length;
    path.push(...coords);
    lapRanges.push([first, path.length - 1, partial]);
  };

  if (distance) {
    const lapLen = pathLength(routeData.lap);
    let total = pathLength(routeData.leadIn);
    while (lapLen > 0 && total + lapLen <= distance) {
      addLap(routeData.lap, false);
      total += lapLen;
    }
    if (total < distance) addLap(partialPath(routeData.lap, distance - total), true);
  } else {
    for (let i = 0; i < (laps || 1); i++) addLap(routeData.lap, false);
  }

  const distances = [0];
  for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + haversine(path[i - 1], path[i]));
  const totalDist = distances[distances.length - 1];
  const lapSpans = lapRanges.map(([from, to, partial]) => ({ from: distances[from], to: distances[to], partial }));

  let leadInDist = 0;
  for (let i = 1; i < routeData.leadIn.length; i++) leadInDist += haversine(routeData.leadIn[i - 1], routeData.leadIn[i]);

  const crossingsMap = findSegmentCrossings(path, distances, routeData.worldSegments || [], routeData.world);
  const { paired, activeDirections } = pairSegmentCrossings(crossingsMap, distances);

  const markers = [];
  crossingsMap.forEach(({ segment, crossings }) => {
    const dirs = activeDirections.get(segment.id) || new Set();
    for (const c of crossings) {
      const active = c.type === "banner" ? dirs.has("forward") || dirs.has("reverse") : dirs.has(c.type);
      if (!active) continue;
      markers.push({
        dist: c.dist,
        type: c.type,
        givesPowerUp: Boolean(segment.givesPowerUp && c.type === "banner"),
        archId: String(segment.archId ?? segment.id),
      });
    }
  });

  return {
    totalDist,
    leadInDist,
    laps: lapSpans,
    elevation: path.map((p, i) => [distances[i], p[2]]),
    markers,
    bars: paired.map((p) => ({
      startDist: p.startDist,
      endDist: p.endDist,
      type: p.type,
      givesPowerUp: Boolean(p.segment.givesPowerUp),
      name: (p.type === "forward" ? p.segment.friendlyNameForward : p.segment.friendlyNameReverse) || p.segment.name || "Segment",
    })),
  };
}

module.exports = { buildRouteProfile };
