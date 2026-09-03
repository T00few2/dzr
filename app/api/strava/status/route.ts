import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole, STRAVA_CONNECTIONS_COLLECTION, toIso } from '@/app/lib/stravaAuth'
import { hasStravaRefreshToken } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    const discordId = String((session as any)?.discordId || '').trim()
    if (!discordId) {
      return NextResponse.json({ connected: false, eligible: false })
    }

    const eligible = await hasClubMemberRole(discordId)
    const snap = await adminDb.collection(STRAVA_CONNECTIONS_COLLECTION).doc(discordId).get()
    if (!snap.exists) {
      return NextResponse.json({ connected: false, eligible })
    }

    const data = snap.data() || {}
    if (!hasStravaRefreshToken(data)) {
      return NextResponse.json({ connected: false, eligible })
    }
    const first = String(data.athleteFirstname || '').trim()
    const last = String(data.athleteLastname || '').trim()
    const athleteName = [first, last].filter(Boolean).join(' ') || null

    return NextResponse.json({
      connected: true,
      eligible,
      athleteId: data.athleteId ?? null,
      athleteName,
      connectedAt: toIso(data.connectedAt),
    })
  } catch (err: any) {
    console.error('strava status error:', err)
    return NextResponse.json({ error: err?.message || 'Status lookup failed' }, { status: 500 })
  }
}
