import { NextResponse } from 'next/server'
import { readSeriesLogo } from '@/app/lib/eventSeries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, props: { params: Promise<{ series: string }> }) {
  const params = await props.params;
  try {
    const logo = await readSeriesLogo(params.series)
    if (!logo) return new NextResponse(null, { status: 404 })
    return new NextResponse(new Uint8Array(logo.bytes), {
      headers: {
        'Content-Type': logo.contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
