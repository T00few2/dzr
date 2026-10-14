import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskData } from '@/app/api/admin/_lib/flask'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const eventId = new URL(req.url).searchParams.get('eventId') || ''
  if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: 'Event id is required' }, { status: 400 })
  const result = await flaskData(`/api/zwiftpower/events/${eventId}/categories`)
  return NextResponse.json(result.body, { status: result.status })
}
