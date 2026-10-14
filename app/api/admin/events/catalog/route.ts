import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { asCatalogRoute } from '@/app/lib/catalogRoute'
import { parseSeriesId } from '@/app/lib/seriesSchedule'
import { addCatalogRoute, ensureCatalog, saveCatalogRoute } from '@/app/lib/seriesCatalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed'
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const seriesId = parseSeriesId(new URL(req.url).searchParams.get('series'))
  if (!seriesId) return NextResponse.json({ error: 'Unknown series' }, { status: 400 })
  try {
    return NextResponse.json({ routes: await ensureCatalog(seriesId) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const seriesId = parseSeriesId(body?.series)
  const route = asCatalogRoute(body?.route)
  if (!seriesId) return NextResponse.json({ error: 'Unknown series' }, { status: 400 })
  if (!route) return NextResponse.json({ error: 'A route name is required' }, { status: 400 })
  try {
    const routes =
      body?.action === 'add'
        ? await addCatalogRoute(seriesId, route)
        : await saveCatalogRoute(seriesId, Number(body?.index), route)
    return NextResponse.json({ routes })
  } catch (error) {
    return errorResponse(error)
  }
}
