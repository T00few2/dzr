import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { STRAVA_CONNECTIONS_COLLECTION } from '@/app/lib/stravaAuth'
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
    let accessToken = ''
    if (snap.exists) {
      try {
        accessToken = readStravaTokens(snap.data() || {}).accessToken
      } catch (err) {
        console.warn('strava disconnect: could not decrypt token (continuing with local delete)', err)
      }
    }

    if (accessToken) {
      try {
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ access_token: accessToken }),
          cache: 'no-store',
        })
      } catch (err) {
        console.warn('strava deauthorize failed (continuing with local delete)', err)
      }
    }

    await ref.delete()
    return NextResponse.json({ connected: false })
  } catch (err: any) {
    console.error('strava disconnect error:', err)
    return NextResponse.json({ error: err?.message || 'Disconnect failed' }, { status: 500 })
  }
}
