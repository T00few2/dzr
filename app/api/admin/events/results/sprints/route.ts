import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskData } from '@/app/api/admin/_lib/flask'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function eventIdFrom(req: Request, body?: { eventId?: unknown }) {
  const fromQuery = new URL(req.url).searchParams.get('eventId') || ''
  const fromBody = String(body?.eventId || '')
  return (fromBody || fromQuery).trim()
}

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const eventId = eventIdFrom(req)
  if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: 'Event id is required' }, { status: 400 })
  const result = await flaskData(`/api/zwiftpower/events/${eventId}/sprints`)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const eventId = eventIdFrom(req, body)
  if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: 'Event id is required' }, { status: 400 })
  const result = await flaskData(`/api/zwiftpower/events/${eventId}/sprints`, { method: 'POST', body: {} })
  return NextResponse.json(result.body, { status: result.status })
}
