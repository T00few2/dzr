import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskJson } from '@/app/api/admin/_lib/flask'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function eventId(raw: string) {
  if (!/^\d+$/.test(raw)) return null
  return raw
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const id = eventId(params.id)
  if (!id) return NextResponse.json({ error: 'Event id must be a number' }, { status: 400 })
  return flaskJson(`/api/zwift/events/${id}`)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const id = eventId(params.id)
  if (!id) return NextResponse.json({ error: 'Event id must be a number' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'tags') {
    return flaskJson(`/api/zwift/events/${id}/tags`, { method: 'POST', body: { tags: body.tags } })
  }
  if (body?.action === 'course') {
    return flaskJson(`/api/zwift/events/${id}/course`, {
      method: 'POST',
      body: {
        routeId: body.routeId,
        laps: body.laps,
        distanceMeters: body.distanceMeters,
        ...(Array.isArray(body.subgroupRoutes) ? { subgroupRoutes: body.subgroupRoutes } : {}),
      },
    })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
