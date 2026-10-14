import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskData } from '@/app/api/admin/_lib/flask'
import { listSavedEvents, SeriesError } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ events: await listSavedEvents('zwifty-fifty') })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load saved races'
    const status = error instanceof SeriesError ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const eventId = String(body?.eventId || '').trim()
  if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: 'Event id is required' }, { status: 400 })
  const result = await flaskData(`/api/zwiftpower/events/${eventId}/categories`, { method: 'POST', body: {} })
  return NextResponse.json(result.body, { status: result.status })
}
