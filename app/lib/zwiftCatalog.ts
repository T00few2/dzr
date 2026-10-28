import { routes as zwiftRoutes, segments as zwiftSegments, worlds as zwiftWorlds } from 'zwift-data'
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

export type ListedRoute = { routeId: number; name: string; world: string }

export function listWorldRoutes(): { world: string; routes: ListedRoute[] }[] {
  const worlds = new Map<string, ListedRoute[]>()
  for (const route of routes) {
    const routeId = Number(route.id)
    const world = String(route.world || '').trim()
    const name = String(route.name || '').trim()
    if (!world || !name || !Number.isInteger(routeId) || routeId <= 0) continue
    const list = worlds.get(world) || []
    list.push({ routeId, name, world })
    worlds.set(world, list)
  }
  return [...worlds.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([world, listed]) => ({
      world,
      routes: listed.sort((left, right) => left.name.localeCompare(right.name)),
    }))
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

type CatalogWorld = { slug: string; name: string }

type CatalogSourceRoute = {
  id?: number
  name: string
  slug: string
  world: string
  distance: number
  elevation: number
  leadInDistance?: number
  leadInElevation?: number
  leadInDistanceFreeRide?: number
  eventOnly?: boolean
  sports?: readonly string[]
  lap?: boolean
  levelLocked?: boolean
  supportsTT?: boolean
  experience?: number
  segments?: readonly string[]
  segmentsOnRoute?: ReadonlyArray<{ from: number; to: number; segment: string }>
  zwiftInsiderUrl?: string
  whatsOnZwiftUrl?: string
  stravaSegmentUrl?: string
  stravaSegmentId?: number
}

type CatalogSourceSegment = {
  slug: string
  name: string
  world: string
  type: string
  distance?: number
  elevation?: number
  avgIncline?: number
}

/** The route, segment and world facts the bot used to read from its own zwift-data install. */
export function zwiftCatalogPayload() {
  const sourceRoutes = zwiftRoutes as unknown as CatalogSourceRoute[]
  const sourceSegments = zwiftSegments as unknown as CatalogSourceSegment[]
  const sourceWorlds = zwiftWorlds as unknown as CatalogWorld[]
  return {
    worlds: sourceWorlds.map((world) => ({ slug: world.slug, name: world.name })),
    routes: sourceRoutes.map((route) => ({
      id: route.id,
      name: route.name,
      slug: route.slug,
      world: route.world,
      distance: route.distance,
      elevation: route.elevation,
      leadInDistance: route.leadInDistance,
      leadInElevation: route.leadInElevation,
      leadInDistanceFreeRide: route.leadInDistanceFreeRide,
      eventOnly: route.eventOnly === true,
      sports: route.sports,
      lap: route.lap === true,
      levelLocked: route.levelLocked === true,
      supportsTT: route.supportsTT === true,
      experience: route.experience,
      segments: route.segments || [],
      segmentsOnRoute: route.segmentsOnRoute || [],
      zwiftInsiderUrl: route.zwiftInsiderUrl,
      whatsOnZwiftUrl: route.whatsOnZwiftUrl,
      stravaSegmentUrl: route.stravaSegmentUrl,
      stravaSegmentId: route.stravaSegmentId,
    })),
    segments: sourceSegments.map((segment) => ({
      slug: segment.slug,
      name: segment.name,
      world: segment.world,
      type: segment.type,
      distance: segment.distance,
      elevation: segment.elevation,
      avgIncline: segment.avgIncline,
    })),
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
