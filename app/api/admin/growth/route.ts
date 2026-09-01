import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const snap = await adminDb.collection(COLLECTIONS.companionClubMembers).limit(100000).get()
  const byDay: Record<string, number> = {}
  snap.docs.forEach((d) => {
    const data: any = d.data()
    const raw = data.joinDate || data.joinedAt || data.rosterSyncedAt || data.createdAt
    const dt = raw ? new Date(typeof raw?.toDate === 'function' ? raw.toDate() : raw) : null
    const key = dt && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : 'unknown'
    byDay[key] = (byDay[key] || 0) + 1
  })
  const days = Object.keys(byDay).sort()
  let running = 0
  const series = days.map((day) => {
    running += byDay[day]
    return { day, added: byDay[day], cumulative: running }
  })
  return NextResponse.json({ total: snap.size, series })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const base = process.env.CONTENT_API_BASE_URL
  const key = process.env.CONTENT_API_KEY
  if (!base || !key) return NextResponse.json({ error: 'CONTENT_API_BASE_URL / CONTENT_API_KEY not set' }, { status: 500 })
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') === 'zwiftpower' ? 'zwiftpower' : 'zwift'
  const path = kind === 'zwiftpower' ? '/api/zwiftpower/club/roster/refresh' : '/api/zwift/club/roster/refresh'
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
  })
  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.status })
}
