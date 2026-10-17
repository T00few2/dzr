import { NextResponse } from 'next/server'
import { elevationForSlug, segmentLatLng } from '@/app/lib/routeElevation'
import { sauceSegmentsForRoute } from '@/app/lib/sauceRouteSegments'
import { resolveCatalogRoute, segmentsToLocate } from '@/app/lib/zwiftCatalog'
import { buildRaceProfile, mergePositionedSegments, placeOnRoute, prepareLap, raceDistanceKm, shiftProfileSegments, type CustomClimbRange, type ProfileSegment } from '@/packages/shared/routeProfile'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseRanges(value: string | null): CustomClimbRange[] {
  if (!value) return []
  try {
    const rows = JSON.parse(value) as unknown
    if (!Array.isArray(rows)) return []
    return rows.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { name?: unknown; fromKm?: unknown; toKm?: unknown }
      const name = String(row.name || '').trim()
      const fromKm = Number(row.fromKm)
      const toKm = Number(row.toKm)
      if (!name || !Number.isFinite(fromKm) || !Number.isFinite(toKm)) return []
      return [{ name, fromKm, toKm }]
    })
  } catch {
    return []
  }
}

function locatedSegments(world: string, placed: ProfileSegment[], distanceM: number[], latlng: number[][]) {
  if (latlng.length !== distanceM.length || latlng.length < 2) return []
  const found: ProfileSegment[] = []
  for (const candidate of segmentsToLocate(world, placed)) {
    const points = segmentLatLng(candidate.slug)
    if (!points) continue
    const hit = placeOnRoute(latlng, distanceM, points)
    if (!hit) continue
    found.push({
      name: candidate.name,
      type: candidate.type,
      fromKm: hit.fromM / 1000,
      toKm: hit.toM / 1000,
      direction: candidate.direction,
    })
  }
  return found
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const world = url.searchParams.get('world') || ''
  const route = url.searchParams.get('route') || ''
  const match = resolveCatalogRoute(world, route)
  if (!match) {
    return NextResponse.json({ error: 'No Zwift route with elevation matched that name' }, { status: 404 })
  }

  try {
    const streams = await elevationForSlug(match.slug)
    const lap = prepareLap(streams.distance, streams.altitude, match.leadInKm, match.lapKm, streams.latlng)
    const raceKm = raceDistanceKm(
      match.lapKm,
      url.searchParams.get('laps'),
      url.searchParams.get('distance'),
      match.leadInKm,
    )
    const climbs = (url.searchParams.get('climbs') || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const positioned = shiftProfileSegments(
      mergePositionedSegments(match.segments, sauceSegmentsForRoute(match.id)),
      lap.leadInKm,
    )
    const segments = [...positioned, ...locatedSegments(match.world, positioned, lap.distance, lap.latlng)]
    const profile = buildRaceProfile({
      distanceM: lap.distance,
      altitudeM: lap.altitude,
      segments,
      raceKm,
      finishText: url.searchParams.get('finish') || '',
      climbNames: climbs,
      customClimbs: parseRanges(url.searchParams.get('ranges')),
      leadInKm: match.leadInKm,
    })
    return NextResponse.json({ routeName: match.name, ...profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the route profile'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
