import { routes as zwiftRoutes, segments as zwiftSegments } from 'zwift-data'
import { slugifyZwiftName, type ProfileSegment } from '@/packages/shared/routeProfile'

type CatalogRoute = {
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
  name: string
  slug: string
  lapKm: number
  leadInKm: number
  stravaSegmentId: number
  segments: ProfileSegment[]
}

export function resolveCatalogRoute(world: string, routeName: string): ResolvedRoute | null {
  const worldSlug = slugifyZwiftName(world)
  const routeSlug = slugifyZwiftName(routeName)
  if (!worldSlug || !routeSlug) return null
  const inWorld = routes.filter((route) => route.world === worldSlug)
  const match =
    inWorld.find((route) => route.slug === routeSlug) ||
    inWorld.find((route) => fold(route.name) === fold(routeName)) ||
    null
  if (!match) return null
  const stravaSegmentId = match.stravaSegmentId || STRAVA_SEGMENT_OVERRIDES[match.slug]
  if (!stravaSegmentId) return null
  return {
    name: match.name,
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
