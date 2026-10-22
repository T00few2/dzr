import { NextResponse } from 'next/server'
import { publicSeries } from '@/app/lib/eventSeries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const series = await publicSeries(params.slug).catch(() => null)
  if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  return NextResponse.json({ series })
}
