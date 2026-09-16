import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

function parseRosterTimestamp(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const dt = (value as { toDate: () => Date }).toDate()
      return Number.isNaN(dt.getTime()) ? null : dt
    } catch {
      return null
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000
    const dt = new Date(ms)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  if (typeof value === 'string') {
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  if (typeof value === 'object') {
    const seconds = (value as { seconds?: number; _seconds?: number }).seconds
      ?? (value as { _seconds?: number })._seconds
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const dt = new Date(seconds * 1000)
      return Number.isNaN(dt.getTime()) ? null : dt
    }
  }
  return null
}

function joinDateForMember(data: Record<string, unknown>): { day: string; estimated: boolean } {
  const joined =
    parseRosterTimestamp(data.membershipCreatedOn)
    || parseRosterTimestamp(data.createdOn)
  if (joined) return { day: joined.toISOString().slice(0, 10), estimated: false }

  const fallback = parseRosterTimestamp(data.rosterSyncedAt) || parseRosterTimestamp(data.updatedAt)
  if (fallback) return { day: fallback.toISOString().slice(0, 10), estimated: true }

  return { day: new Date().toISOString().slice(0, 10), estimated: true }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const snap = await adminDb.collection(COLLECTIONS.companionClubMembers).limit(100000).get()
  const byDay: Record<string, number> = {}
  let estimated = 0
  snap.docs.forEach((d) => {
    const { day, estimated: usedEstimate } = joinDateForMember(d.data() as Record<string, unknown>)
    if (usedEstimate) estimated += 1
    byDay[day] = (byDay[day] || 0) + 1
  })
  const days = Object.keys(byDay).sort()
  let running = 0
  const series = days.map((day) => {
    running += byDay[day]
    return { day, added: byDay[day], cumulative: running }
  })
  return NextResponse.json({ total: snap.size, estimatedJoinDates: estimated, series })
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
