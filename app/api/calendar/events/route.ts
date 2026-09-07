import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { getRacingScore } from '@/app/utils/fetchZPdata'
import { compactZwiftEvents } from '@/packages/shared/zwiftEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Upcoming DZR events, offered as suggestions for a member's own calendar.
 *
 * The same public Zwift feed app/api/getevents already uses. Verified 2026-09-07: a rolling ~7-day
 * window, so this is "DZR events this week", not a season — anything further out is manual entry.
 * ZRL does not appear in it at all, being WTRL-organised rather than DZR-tagged.
 *
 * The shaping lives in packages/shared/zwiftEvents.js, which is pure and unit tested; this file is
 * only the fetch, the cache and the auth. Nothing here writes to the calendar — the member picks a
 * category and posts it themselves, so a suggestion is a copy rather than a subscription.
 */

const FEED_URL = 'https://us-or-rly101.zwift.com/api/public/events/upcoming?limit=200&tags=dzr'
const CACHE_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 6000

let cache: { at: number; events: unknown[] } | null = null

async function loadEvents(): Promise<unknown[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.events

  // An unauthenticated third party on a page-load path: bounded, and any failure degrades to an
  // empty picker rather than breaking the calendar.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(FEED_URL, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`zwift feed responded ${res.status}`)
    const events = compactZwiftEvents(await res.json())
    cache = { at: Date.now(), events }
    return events
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The member's Zwift Racing Score, used only to highlight which category they are likely eligible
 * for. A hint, never a selection: they click the category themselves, and this is wrong often
 * enough — stale stats, no linked Zwift id — that it must not be load-bearing.
 */
async function racingScoreFor(discordId: string): Promise<number | null> {
  try {
    const userSnap = await adminDb.collection('users').doc(discordId).get()
    const zwiftId = userSnap.exists ? userSnap.get('zwiftId') : null
    if (!zwiftId) return null

    const latest = await adminDb.collection('club_stats').orderBy('__name__', 'desc').limit(1).get()
    if (latest.empty) return null

    const riders: any[] = (latest.docs[0].data() as any)?.data?.riders || []
    const rider = riders.find((r) => String(r?.riderId) === String(zwiftId))
    return rider ? getRacingScore(rider) : null
  } catch (err) {
    console.warn('calendar events: could not resolve racing score', err)
    return null
  }
}

export async function GET(req: Request) {
  const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  const discordId = String((session as any)?.discordId || '').trim()
  if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const [events, racingScore] = await Promise.all([
    loadEvents().catch((err) => {
      console.warn('calendar events: zwift feed unavailable', err)
      return null
    }),
    racingScoreFor(discordId),
  ])

  // "unavailable" is kept distinct from "no events this week" so the page can say which happened
  // rather than showing an empty list that looks like a quiet week.
  if (events === null) return NextResponse.json({ events: [], racingScore, unavailable: true })
  return NextResponse.json({ events, racingScore, unavailable: false })
}
