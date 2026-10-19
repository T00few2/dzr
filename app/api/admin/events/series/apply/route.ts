import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { applySeriesDate, listSeriesViewsWithAutomation } from '@/app/lib/seriesApply'
import { parseSeriesId, SeriesError } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed'
  const status = error instanceof SeriesError ? error.status : 400
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const seriesId = parseSeriesId(body?.series)
  const date = String(body?.date || '')
  if (!seriesId) return NextResponse.json({ error: 'Unknown series' }, { status: 400 })

  try {
    const requested = Number(body?.routeId)
    const applied = await applySeriesDate(seriesId, date, Number.isInteger(requested) ? requested : undefined)
    return NextResponse.json({
      series: await listSeriesViewsWithAutomation(),
      eventId: applied.eventId,
      route: applied.route,
      discordError: applied.discordError,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
