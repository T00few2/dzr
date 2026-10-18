import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { saveSeriesLogo, seriesSlug } from '@/app/lib/eventSeries'
import { SeriesError } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const form = await req.formData().catch(() => null)
  const slug = seriesSlug(String(form?.get('slug') || ''))
  const file = form?.get('logo')
  if (!slug || !(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a logo image' }, { status: 400 })
  }
  if (!TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP logo' }, { status: 400 })
  }
  if (file.size > 2_000_000) {
    return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 })
  }
  try {
    const logoUrl = await saveSeriesLogo(slug, Buffer.from(await file.arrayBuffer()), file.type)
    return NextResponse.json({ logoUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not store the logo'
    const status = error instanceof SeriesError ? error.status : 400
    return NextResponse.json({ error: message }, { status })
  }
}
