import { NextResponse } from 'next/server'
import { listPublishedSeries } from '@/app/lib/eventSeries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ series: await listPublishedSeries() })
  } catch {
    return NextResponse.json({ series: [] })
  }
}
