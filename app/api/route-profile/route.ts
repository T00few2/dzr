import { NextResponse } from 'next/server'
import { elevationForSegment } from '@/app/lib/stravaElevation'
import { resolveCatalogRoute } from '@/app/lib/zwiftCatalog'
import { buildRaceProfile, prepareLap, raceDistanceKm } from '@/packages/shared/routeProfile'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const world = url.searchParams.get('world') || ''
  const route = url.searchParams.get('route') || ''
  const match = resolveCatalogRoute(world, route)
  if (!match) {
    return NextResponse.json({ error: 'No Zwift route with elevation matched that name' }, { status: 404 })
  }

  try {
    const streams = await elevationForSegment(match.stravaSegmentId)
    const lap = prepareLap(streams.distance, streams.altitude, match.leadInKm, match.lapKm)
    const raceKm = raceDistanceKm(match.lapKm, url.searchParams.get('laps'), url.searchParams.get('distance'))
    const climbs = (url.searchParams.get('climbs') || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const profile = buildRaceProfile({
      distanceM: lap.distance,
      altitudeM: lap.altitude,
      segments: match.segments,
      raceKm,
      finishText: url.searchParams.get('finish') || '',
      climbNames: climbs,
    })
    return NextResponse.json({ routeName: match.name, ...profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the route profile'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
