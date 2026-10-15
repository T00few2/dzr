const ORDINALS = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
}

function roundKm(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function foldName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\b(reverse|rev\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function wantsReverse(value) {
  return /\b(reverse|rev\.?)\b/i.test(String(value || ""))
}

function slugifyZwiftName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`"]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function parseFinish(value) {
  const text = String(value || "").trim()
  if (!text) return null
  const onBanner = text.match(
    /^(?:blue\s+)?banner(?:\s+(\d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:st|nd|rd|th)?\s+time)?\s+on(?:\s+top\s+of)?\s+(.+)$/i
  )
  if (onBanner) {
    const raw = String(onBanner[1] || "").toLowerCase()
    const pass = raw ? ORDINALS[raw] || Number(raw) : 1
    return { pass: pass > 0 ? pass : 1, name: onBanner[2].trim() }
  }
  const trailing = text.match(/^(.+?)\s+banner$/i)
  if (trailing) return { pass: 1, name: trailing[1].trim() }
  return null
}

const NAME_ALIASES = {
  "governor st": ["richmond kom"],
  "libby hill": ["richmond kom"],
  "ny kom": ["new york kom"],
  "ny sprint": ["new york sprint"],
  "leg snapper": ["innsbruck kom"],
  "legsnapper": ["innsbruck kom"],
  "monument ave": ["richmond sprint"],
}

function comparableName(value) {
  return foldName(value).replace(/\bgroove\b/g, "grove")
}

function queryKeys(value) {
  const folded = comparableName(value)
  const stripped = folded
    .replace(/\b(koms|kom|climbs|climb|sprints|sprint|banners|banner)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const keys = new Set([folded, stripped])
  for (const key of [folded, stripped]) {
    for (const alias of NAME_ALIASES[key] || []) keys.add(alias)
  }
  return [...keys].filter((key) => key.length >= 3)
}

function namesMatch(segmentName, query) {
  const left = comparableName(segmentName)
  if (!left) return false
  return queryKeys(query).some((right) => left === right || left.startsWith(right) || right.startsWith(left))
}

function placeOnRoute(routeLatLng, routeDistanceM, segmentLatLng) {
  if (!Array.isArray(routeLatLng) || !Array.isArray(segmentLatLng)) return null
  if (routeLatLng.length < 2 || segmentLatLng.length < 2 || routeLatLng.length !== routeDistanceM.length) return null
  const sampleAt = [0, Math.floor(segmentLatLng.length / 2), segmentLatLng.length - 1]
  const hits = sampleAt.map((index) => nearestRoutePoint(routeLatLng, segmentLatLng[index]))
  if (hits.some((hit) => hit.meters > 40)) return null
  const fromM = routeDistanceM[hits[0].index]
  const toM = routeDistanceM[hits[2].index]
  const along = Math.abs(toM - fromM)
  const length = pathLength(segmentLatLng)
  if (!(along > 30) || along > length * 2.5 || along < length * 0.35) return null
  return { fromM: Math.min(fromM, toM), toM: Math.max(fromM, toM) }
}

function pathLength(points) {
  let total = 0
  for (let index = 1; index < points.length; index += 1) total += haversineMeters(points[index - 1], points[index])
  return total
}

function nearestRoutePoint(routeLatLng, point) {
  let index = 0
  let meters = Infinity
  for (let cursor = 0; cursor < routeLatLng.length; cursor += 1) {
    const distance = haversineMeters(routeLatLng[cursor], point)
    if (distance < meters) {
      meters = distance
      index = cursor
    }
  }
  return { index, meters }
}

function haversineMeters(a, b) {
  const toRad = Math.PI / 180
  const dLat = (b[0] - a[0]) * toRad
  const dLon = (b[1] - a[1]) * toRad
  const lat1 = a[0] * toRad
  const lat2 = b[0] * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function displaySegmentName(segment) {
  const name = String(segment.name || "").trim()
  if (segment.direction === "reverse" && !wantsReverse(name)) return `${name} Reverse`
  return name
}

function prepareLap(distance, altitude, leadInKm, lapKm, latlng) {
  const meters = Array.isArray(distance) ? distance.map(Number) : []
  const heights = Array.isArray(altitude) ? altitude.map(Number) : []
  const points = Array.isArray(latlng) ? latlng : []
  const leadInM = Number(leadInKm) > 0 ? Number(leadInKm) * 1000 : 0
  const lapM = Number(lapKm) > 0 ? Number(lapKm) * 1000 : 0
  const endM = meters.length ? meters[meters.length - 1] : 0
  const includesLeadIn =
    leadInM > 0 &&
    lapM > 0 &&
    meters.length > 1 &&
    Math.abs(endM - (lapM + leadInM)) <= Math.abs(endM - lapM)
  if (!includesLeadIn) return { distance: meters, altitude: heights, latlng: points }
  let start = meters.findIndex((point) => point >= leadInM)
  if (start < 0) start = 0
  let nextDistance = meters.slice(start).map((point) => Math.max(0, point - leadInM))
  let nextAltitude = heights.slice(start)
  let nextLatLng = points.slice(start)
  if (nextDistance.length && nextDistance[0] > 0) {
    nextDistance = [0, ...nextDistance]
    nextAltitude = [nextAltitude[0] || 0, ...nextAltitude]
    if (nextLatLng.length) nextLatLng = [nextLatLng[0], ...nextLatLng]
  }
  return { distance: nextDistance, altitude: nextAltitude, latlng: nextLatLng }
}

function raceDistanceKm(lapKm, lapsText, distanceText) {
  const laps = String(lapsText || "").trim()
  const whole = laps.match(/^(\d+)$/)
  const distance = Number(String(distanceText || "").replace(",", "."))
  if (whole && Number(lapKm) > 0) return roundKm(Number(lapKm) * Number(whole[1]))
  if (Number.isFinite(distance) && distance > 0) return distance
  return Number(lapKm) > 0 ? roundKm(lapKm) : 0
}

function downsample(distance, altitude, target) {
  if (distance.length <= target) return { distance, altitude }
  const step = Math.max(1, Math.floor(distance.length / target))
  const outDistance = []
  const outAltitude = []
  for (let i = 0; i < distance.length; i += step) {
    outDistance.push(distance[i])
    outAltitude.push(altitude[i] || 0)
  }
  const last = distance.length - 1
  if (outDistance[outDistance.length - 1] !== distance[last]) {
    outDistance.push(distance[last])
    outAltitude.push(altitude[last] || 0)
  }
  return { distance: outDistance, altitude: outAltitude }
}

function tileLap(distanceM, altitudeM, segments, raceKm) {
  const lapKm = distanceM.length ? distanceM[distanceM.length - 1] / 1000 : 0
  const limit = Number(raceKm) > 0 ? Number(raceKm) : lapKm
  if (!(lapKm > 0) || !(limit > 0)) return { distanceKm: [], altitude: [], segments: [], lapKm }
  const copies = Math.max(1, Math.ceil((limit - 1e-6) / lapKm))
  const distanceKm = []
  const altitude = []
  const tiled = []
  for (let copy = 0; copy < copies; copy += 1) {
    const offset = copy * lapKm
    for (let i = 0; i < distanceM.length; i += 1) {
      const km = distanceM[i] / 1000 + offset
      if (km > limit + 1e-6) break
      if (copy > 0 && distanceM[i] === 0) continue
      distanceKm.push(roundKm(km))
      altitude.push(altitudeM[i] || 0)
    }
    for (const segment of segments) {
      const from = segment.fromKm + offset
      if (from >= limit) continue
      const to = Math.min(segment.toKm + offset, limit)
      tiled.push({
        ...segment,
        fromKm: roundKm(from),
        toKm: roundKm(Math.max(to, from)),
      })
    }
  }
  const down = downsample(distanceKm, altitude, 500)
  return { distanceKm: down.distance, altitude: down.altitude, segments: tiled, lapKm }
}

function matchingSegments(segments, query) {
  const hits = segments.filter((segment) => namesMatch(segment.name, query))
  const reverse = wantsReverse(query)
  const directed = hits.filter((segment) => (segment.direction === "reverse") === reverse)
  return (directed.length ? directed : hits).slice().sort((a, b) => a.fromKm - b.fromKm)
}

function zoomOf(segment, raceKm, title) {
  const from = Math.max(0, segment.fromKm - 0.15)
  const to = Math.min(raceKm, Math.max(segment.toKm, segment.fromKm) + 0.08)
  return { title, fromKm: roundKm(from), toKm: roundKm(Math.max(to, from + 0.2)) }
}

function finishZoom(segments, finishText, raceKm) {
  const parsed = parseFinish(finishText)
  if (!parsed) return null
  const hit = matchingSegments(segments, parsed.name)[parsed.pass - 1]
  if (!hit) return { title: parsed.name, fromKm: 0, toKm: 0, matched: false }
  return { ...zoomOf(hit, raceKm, parsed.name), matched: true }
}

function climbZooms(segments, climbNames, raceKm) {
  const names = (Array.isArray(climbNames) ? climbNames : []).map((name) => String(name || "").trim()).filter(Boolean)
  if (names.length) {
    return names.map((name) => {
      const hit = matchingSegments(segments, name).find((segment) => segment.type === "climb") || matchingSegments(segments, name)[0]
      if (!hit) return { title: name, fromKm: 0, toKm: 0, matched: false }
      return { ...zoomOf(hit, raceKm, name), matched: true }
    })
  }
  const seen = new Set()
  const zooms = []
  for (const segment of segments) {
    if (segment.type !== "climb") continue
    const key = `${foldName(segment.name)}::${segment.direction}`
    if (seen.has(key)) continue
    seen.add(key)
    zooms.push({ ...zoomOf(segment, raceKm, displaySegmentName(segment)), matched: true })
    if (zooms.length >= 8) break
  }
  return zooms
}

function sprintRows(segments, lapKm) {
  const groups = new Map()
  for (const segment of segments) {
    if (segment.type !== "sprint") continue
    const key = `${foldName(segment.name)}::${segment.direction}`
    const lap = lapKm > 0 ? Math.floor(segment.fromKm / lapKm) + 1 : 1
    if (!groups.has(key)) groups.set(key, { name: displaySegmentName(segment), laps: [] })
    const row = groups.get(key)
    if (!row.laps.includes(lap)) row.laps.push(lap)
  }
  return [...groups.values()].map((row) => ({
    name: row.name,
    laps: row.laps.sort((a, b) => a - b).join(","),
  }))
}

function buildRaceProfile({ distanceM, altitudeM, segments, raceKm, finishText, climbNames }) {
  const tiled = tileLap(distanceM, altitudeM, segments, raceKm)
  return {
    lapKm: roundKm(tiled.lapKm),
    raceKm: roundKm(raceKm),
    distanceKm: tiled.distanceKm,
    altitudeM: tiled.altitude,
    segments: tiled.segments,
    finish: finishZoom(tiled.segments, finishText, tiled.distanceKm[tiled.distanceKm.length - 1] || raceKm),
    climbs: climbZooms(tiled.segments, climbNames, tiled.distanceKm[tiled.distanceKm.length - 1] || raceKm),
    sprints: sprintRows(tiled.segments, tiled.lapKm),
  }
}

function profileImageSrc(series, routeName) {
  const route = String(routeName || "")
  const folder = series === "zwifty-fifty" ? "the-zwifty-fifty" : "dzr-after-party"
  return `/${folder}/${route.toLowerCase().replace(/\s+/g, "-")}/${route.split(" ").join("-")}-profile.png`
}

module.exports = {
  foldName,
  slugifyZwiftName,
  parseFinish,
  prepareLap,
  raceDistanceKm,
  buildRaceProfile,
  profileImageSrc,
  placeOnRoute,
}
