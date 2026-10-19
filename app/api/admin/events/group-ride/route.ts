import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import {
  applyGroupRide,
  GroupRideError,
  groupRideView,
  saveGroupRideRoutes,
  setGroupRideOverride,
} from '@/app/lib/groupRide'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed'
  const status = error instanceof GroupRideError ? error.status : 400
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json(await groupRideView())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  try {
    if (body?.action === 'routes') return NextResponse.json(await saveGroupRideRoutes(String(body.anchorDate || ''), body.routes))
    if (body?.action === 'override') {
      return NextResponse.json(await setGroupRideOverride(String(body.date || ''), Number(body.routeId)))
    }
    if (body?.action === 'apply') {
      const applied = await applyGroupRide(String(body.date || ''))
      return NextResponse.json({ ...(await groupRideView()), ...applied })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}
