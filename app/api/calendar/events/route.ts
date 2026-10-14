import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { getRacingScore } from '@/app/utils/fetchZPdata'
import { loadUpcomingDzrEvents } from '@/app/lib/zwiftPublicEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Upcoming DZR events, offered as suggestions for a member's own calendar.
 *
 * The same public Zwift feed app/api/getevents already uses. Verified 2026-09-07: a rolling ~7-day
 * window, so this is "DZR events this week", not a season — anything further out is manual entry.
 * ZRL does not appear in it at all, being WTRL-organised rather than DZR-tagged.
 *
 * The shaping lives in packages/shared/zwiftEvents.js, and the fetch lives in
 * app/lib/zwiftPublicEvents.ts. This file is the auth and the racing-score hint. Nothing here
 * writes to the calendar — the member picks a category and posts it themselves, so a suggestion
 * is a copy rather than a subscription.
 */

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
    loadUpcomingDzrEvents().catch((err) => {
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
