import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { listSeriesViews, parseSeriesId, setSeriesOverride, SeriesError } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed'
  const status = error instanceof SeriesError ? error.status : 400
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ series: await listSeriesViews() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const seriesId = parseSeriesId(body?.series)
  if (!seriesId) return NextResponse.json({ error: 'Unknown series' }, { status: 400 })
  try {
    const series = await setSeriesOverride(seriesId, String(body?.date || ''), String(body?.route || ''))
    return NextResponse.json({ series })
  } catch (error) {
    return errorResponse(error)
  }
}
