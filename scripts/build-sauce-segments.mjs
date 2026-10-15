import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { routes, segments } from 'zwift-data'

const require = createRequire(import.meta.url)
const { foldName } = require('../packages/shared/routeProfile.js')

const source = process.argv[2] || 'C:/Users/Chris/OneDrive/Dokumenter/DZR/DCU/DCU Member liga/backend/data'
const outFile = path.join(process.cwd(), 'data', 'sauce-route-segments.json')

const worlds = JSON.parse(fs.readFileSync(path.join(source, 'worldlist.json'), 'utf8'))
const worldSlug = new Map(worlds.map((world) => [world.worldId, foldName(world.name).replace(/ /g, '-')]))
const sauceRoutes = JSON.parse(fs.readFileSync(path.join(source, 'routes.json'), 'utf8'))

const byId = new Map()
for (const world of worlds) {
  const file = path.join(source, 'worlds', String(world.worldId), 'segments.json')
  if (!fs.existsSync(file)) continue
  for (const segment of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    byId.set(String(segment.idForward), { segment, direction: 'forward', worldId: world.worldId })
    if (segment.idReverse != null) {
      byId.set(String(segment.idReverse), { segment, direction: 'reverse', worldId: world.worldId })
    }
  }
}

const catalogByWorld = new Map()
for (const segment of segments) {
  const list = catalogByWorld.get(segment.world) || []
  list.push(segment)
  catalogByWorld.set(segment.world, list)
}

function isReverseCatalog(segment) {
  const slug = String(segment.slug || '')
  const name = String(segment.name || '')
  const url = String(segment.whatsOnZwiftUrl || '')
  return slug.endsWith('-rev') || slug.includes('-reverse') || /\breverse\b|\brev\b/i.test(name) || url.includes('/reverse')
}

function catalogMatch(world, sauceName, direction) {
  const key = foldName(sauceName)
  if (!key) return null
  const hits = (catalogByWorld.get(world) || []).filter((segment) => foldName(segment.name) === key)
  const directed = hits.filter((segment) => isReverseCatalog(segment) === (direction === 'reverse'))
  const pool = directed.length ? directed : hits
  return pool.length === 1 ? pool[0] : null
}

const GENERIC = new Set(['sprint', 'kom', 'climb'])

function keywordType(name) {
  if (/sprint/i.test(name)) return 'sprint'
  if (/\bkom\b|climb/i.test(name)) return 'climb'
  return null
}

const output = {}
let missing = 0
let kept = 0
const deltas = []

for (const route of sauceRoutes) {
  const slug = worldSlug.get(route.worldId)
  const lapKm = Number(route.distanceInMeters) / 1000
  const catalogRoute = routes.find((item) => item.id === route.id)
  const positioned = new Set((catalogRoute?.segmentsOnRoute || []).map((item) => item.segment))
  const unpositioned = (catalogRoute?.segments || []).filter((item) => !positioned.has(item))
  const rows = []
  for (const entry of route.segments || []) {
    const found = byId.get(String(entry.id))
    if (!found) {
      missing += 1
      continue
    }
    const sauceName = found.direction === 'reverse'
      ? found.segment.nameReverse || found.segment.nameForward
      : found.segment.nameForward
    if (!sauceName) continue
    const distanceM = Number(entry.distance) || 0
    if (found.segment.requiresAllCheckpoints || found.segment.archId == null) continue
    if (lapKm > 0 && distanceM > lapKm * 700) continue
    const fromKm = Math.round(Number(entry.offset) * 10) / 10000
    const toKm = Math.round((Number(entry.offset) + distanceM) * 10) / 10000
    if (!(fromKm >= 0) || (lapKm > 0 && fromKm > lapKm + 0.15)) continue

    let name = sauceName
    let type = keywordType(sauceName)
    const exact = catalogMatch(slug, sauceName, found.direction)
    if (exact && (exact.type === 'sprint' || exact.type === 'climb')) {
      name = exact.name
      type = exact.type
    } else if (GENERIC.has(foldName(sauceName))) {
      const pending = unpositioned
        .map((item) => (catalogByWorld.get(slug) || []).find((segment) => segment.slug === item))
        .filter((segment) => segment && segment.type === type && isReverseCatalog(segment) === (found.direction === 'reverse'))
      if (pending.length === 1) {
        name = pending[0].name
        type = pending[0].type
      }
    }
    if (type !== 'sprint' && type !== 'climb') continue
    if (GENERIC.has(foldName(name))) continue
    rows.push({
      name,
      type,
      fromKm: Math.round(fromKm * 1000) / 1000,
      toKm: Math.round(Math.max(fromKm, toKm) * 1000) / 1000,
      direction: found.direction,
    })
    kept += 1
  }
  if (!rows.length) continue
  rows.sort((left, right) => left.fromKm - right.fromKm || left.name.localeCompare(right.name))
  output[String(route.id)] = rows

  for (const placed of catalogRoute?.segmentsOnRoute || []) {
    const catalog = (catalogByWorld.get(slug) || []).find((segment) => segment.slug === placed.segment)
    if (!catalog || (catalog.type !== 'sprint' && catalog.type !== 'climb')) continue
    const nearest = rows
      .filter((row) => row.type === catalog.type)
      .map((row) => ({ row, delta: row.fromKm - placed.from }))
      .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta))[0]
    if (nearest && Math.abs(nearest.delta) < 0.6) deltas.push(nearest.delta)
  }
}

deltas.sort((left, right) => left - right)
const mid = deltas[Math.floor(deltas.length / 2)] || 0
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(output))
const suki = output['3367186349'] || []
console.log(JSON.stringify({
  routes: Object.keys(output).length,
  segments: kept,
  missingIds: missing,
  compared: deltas.length,
  medianDeltaKm: Math.round(mid * 1000) / 1000,
  p90DeltaKm: Math.round((deltas[Math.floor(deltas.length * 0.9)] || 0) * 1000) / 1000,
  bytes: fs.statSync(outFile).size,
  suki,
}, null, 2))
