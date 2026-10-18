import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { applyEventSeries, setWeeklyOverride } from '@/app/lib/eventSeries'
import { SeriesError } from '@/app/lib/seriesSchedule'

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
  try {
    if (body?.action === 'override') {
      const series = await setWeeklyOverride(String(body.slug || ''), String(body.date || ''), String(body.route || ''))
      return NextResponse.json({ series })
    }
    const result = await applyEventSeries(String(body.slug || ''), String(body.date || ''), String(body.route || ''))
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
