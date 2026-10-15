import { routes as zwiftRoutes, segments as zwiftSegments } from 'zwift-data'
import { foldName, slugifyZwiftName, type ProfileSegment } from '@/packages/shared/routeProfile'

type CatalogRoute = {
  id?: number
  world: string
  slug: string
  name: string
  distance: number
  leadInDistance?: number
  stravaSegmentId?: number
  stravaSegmentUrl?: string
  segmentsOnRoute: ReadonlyArray<{ from: number; to: number; segment: string }>
}

type CatalogSegment = {
  world: string
  slug: string
  name: string
  type: 'sprint' | 'climb' | 'segment'
  whatsOnZwiftUrl?: string
}

const STRAVA_SEGMENT_OVERRIDES: Record<string, number> = {
  'queens-highway-after-party': 39270897,
  'hudson-hustle': 40654556,
}

const routes = zwiftRoutes as unknown as CatalogRoute[]
const segments = zwiftSegments as unknown as CatalogSegment[]
const segmentBySlug = new Map(segments.map((segment) => [segment.slug, segment]))

function fold(value: string) {
  return slugifyZwiftName(value).replace(/-/g, '')
}

function inferDirection(slug: string, name: string, url?: string): 'forward' | 'reverse' {
  const segmentSlug = slug.toLowerCase()
  const segmentName = name.toLowerCase()
  const page = (url || '').toLowerCase()
  if (segmentSlug.endsWith('-rev') || segmentSlug.includes('-reverse')) return 'reverse'
  if (segmentName.includes(' rev') || segmentName.includes('reverse')) return 'reverse'
  if (page.includes('/reverse')) return 'reverse'
  return 'forward'
}

export type ResolvedRoute = {
  id?: number
  name: string
  world: string
  slug: string
  lapKm: number
  leadInKm: number
  stravaSegmentId: number
  segments: ProfileSegment[]
}

export type SegmentCandidate = {
  slug: string
  name: string
  type: 'sprint' | 'climb'
  direction: 'forward' | 'reverse'
}

export function resolveCatalogRoute(world: string, routeName: string): ResolvedRoute | null {
  const worldSlug = slugifyZwiftName(world)
  const routeSlug = slugifyZwiftName(routeName)
  if (!routeSlug) return null
  const named = routes.filter((route) => route.slug === routeSlug || fold(route.name) === fold(routeName))
  const inWorld = worldSlug ? named.filter((route) => route.world === worldSlug) : []
  const match = inWorld[0] || (named.length === 1 ? named[0] : null)
  if (!match) return null
  const stravaSegmentId = match.stravaSegmentId || STRAVA_SEGMENT_OVERRIDES[match.slug] || 0
  return {
    id: match.id,
    name: match.name,
    world: match.world,
    slug: match.slug,
    lapKm: Number(match.distance) || 0,
    leadInKm: Number(match.leadInDistance) || 0,
    stravaSegmentId,
    segments: match.segmentsOnRoute.map((item) => {
      const segment = segmentBySlug.get(item.segment)
      const name = segment?.name || item.segment
      return {
        name,
        type: segment?.type || 'segment',
        fromKm: item.from,
        toKm: item.to,
        direction: inferDirection(item.segment, name, segment?.whatsOnZwiftUrl),
      }
    }),
  }
}

export function segmentsToLocate(world: string, placed: ProfileSegment[]): SegmentCandidate[] {
  const worldSlug = slugifyZwiftName(world)
  const names = new Set(placed.map((segment) => foldName(segment.name)))
  return segments
    .filter((segment) => segment.world === worldSlug && (segment.type === 'sprint' || segment.type === 'climb'))
    .filter((segment) => !names.has(foldName(segment.name)))
    .map((segment) => ({
      slug: segment.slug,
      name: segment.name,
      type: segment.type as 'sprint' | 'climb',
      direction: inferDirection(segment.slug, segment.name, segment.whatsOnZwiftUrl),
    }))
}
