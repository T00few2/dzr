import { NextResponse } from 'next/server'
import { parseSeriesId, publishedRaces } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { series: string } }) {
  const seriesId = parseSeriesId(params.series)
  if (!seriesId) return NextResponse.json({ error: 'Unknown series' }, { status: 404 })
  try {
    const races = await publishedRaces(seriesId)
    return NextResponse.json({
      races: races.map((race) => ({ date: race.label, route: race.route, raceID: race.raceID })),
    })
  } catch (error) {
    console.error(`Series schedule failed for ${seriesId}:`, error)
    return NextResponse.json({ races: [] })
  }
}
