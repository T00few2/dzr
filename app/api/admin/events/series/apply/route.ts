import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskData } from '@/app/api/admin/_lib/flask'
import { postSeriesDiscord } from '@/app/lib/seriesDiscord'
import {
  courseForRoute,
  listSeriesViews,
  matchingFeedEvent,
  parseSeriesId,
  plannedSeriesRoute,
  savePublishedEvent,
  SeriesError,
} from '@/app/lib/seriesSchedule'

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
    const route = await plannedSeriesRoute(seriesId, date)
    const event = await matchingFeedEvent(seriesId, date)
    const course = await courseForRoute(seriesId, route)
    const payload: { routeId: number; laps?: number; distanceMeters?: number } = { routeId: course.routeId }
    if ('laps' in course) payload.laps = course.laps
    else payload.distanceMeters = course.distanceMeters

    const updated = await flaskData(`/api/zwift/events/${event.id}/course`, { method: 'POST', body: payload })
    if (updated.status >= 400) {
      return NextResponse.json(
        { error: String(updated.body?.error || 'Zwift update failed') },
        { status: updated.status }
      )
    }

    await savePublishedEvent(seriesId, date, String(event.id), course.route)

    let discordError = ''
    try {
      await postSeriesDiscord(seriesId, date, course.route, String(event.id))
    } catch (error) {
      discordError = error instanceof Error ? error.message : 'Discord post failed'
    }

    return NextResponse.json({
      series: await listSeriesViews(),
      eventId: event.id,
      route: course.route,
      discordError,
      event: updated.body,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
