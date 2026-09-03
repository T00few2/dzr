import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { revokeStravaGrant, STRAVA_CONNECTIONS_COLLECTION } from '@/app/lib/stravaAuth'
import { readStravaTokens } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    const discordId = String((session as any)?.discordId || '').trim()
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const ref = adminDb.collection(STRAVA_CONNECTIONS_COLLECTION).doc(discordId)
    const snap = await ref.get()
    let revokedOnStrava = false

    if (snap.exists) {
      const data = snap.data() || {}
      try {
        const tokens = readStravaTokens(data)
        revokedOnStrava = await revokeStravaGrant({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Number(data.expiresAt) || 0,
        })
      } catch (err) {
        console.warn('strava disconnect: could not decrypt/revoke (continuing with local delete)', err)
      }
      await ref.delete()
    }

    return NextResponse.json({
      connected: false,
      revokedOnStrava,
      stravaAppsUrl: 'https://www.strava.com/settings/apps',
    })
  } catch (err: any) {
    console.error('strava disconnect error:', err)
    return NextResponse.json({ error: err?.message || 'Disconnect failed' }, { status: 500 })
  }
}
