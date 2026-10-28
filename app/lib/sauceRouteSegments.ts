import fs from 'node:fs'
import path from 'node:path'
import type { ProfileSegment } from '@/packages/shared/routeProfile'

type SauceSegment = ProfileSegment

let cache: Record<string, SauceSegment[]> | null = null
let archIds: Map<string, number> | null = null

function load(): Record<string, SauceSegment[]> {
  if (!cache) {
    const file = path.join(process.cwd(), 'data', 'sauce-route-segments.json')
    cache = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, SauceSegment[]>) : {}
  }
  return cache
}

export function sauceSegmentsForRoute(routeId?: number): ProfileSegment[] {
  if (!routeId) return []
  return load()[String(routeId)] || []
}

function archKey(name: string): string {
  return String(name || '').replace(/\s+rev\.?$/i, '').trim().toLowerCase()
}

// A banner keeps its Zwift arch number on every route, forward or reverse, so routes newer than the
// Sauce snapshot get theirs by segment name. Event arch_powerup tags are keyed by these numbers.
export function withArchIds(segments: ProfileSegment[]): ProfileSegment[] {
  if (!archIds) {
    archIds = new Map()
    for (const list of Object.values(load())) {
      for (const segment of list) {
        if (segment.archId != null && !archIds.has(archKey(segment.name))) archIds.set(archKey(segment.name), segment.archId)
      }
    }
  }
  const known = archIds
  return segments.map((segment) => {
    if (segment.archId != null) return segment
    const archId = known.get(archKey(segment.name))
    return archId != null ? { ...segment, archId } : segment
  })
}
