import fs from 'node:fs'
import path from 'node:path'
import type { ProfileSegment } from '@/packages/shared/routeProfile'

type SauceSegment = ProfileSegment

let cache: Record<string, SauceSegment[]> | null = null

export function sauceSegmentsForRoute(routeId?: number): ProfileSegment[] {
  if (!routeId) return []
  if (!cache) {
    const file = path.join(process.cwd(), 'data', 'sauce-route-segments.json')
    if (!fs.existsSync(file)) return []
    cache = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, SauceSegment[]>
  }
  return cache[String(routeId)] || []
}
