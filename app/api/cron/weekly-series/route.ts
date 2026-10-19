import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { runDueRouteUpdates } from '@/app/lib/seriesApply'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: Request) {
  const expected = String(process.env.WEEKLY_SERIES_CRON_SECRET || '')
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!expected || !token || expected.length !== token.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobs = await runDueRouteUpdates()
  return NextResponse.json({ jobs })
}
