import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { wipeCoachStravaForDiscordId } from '@/app/lib/wipeCoachStrava'
import { STRAVA_APPS_URL } from '@/app/lib/stravaCoachLinks'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    const discordId = String((session as any)?.discordId || '').trim()
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const result = await wipeCoachStravaForDiscordId(discordId, {
      revokeOnStrava: true,
      notifyUser: true,
    })

    return NextResponse.json({
      connected: false,
      revokedOnStrava: result.revokedOnStrava,
      deletionNotified: result.notified,
      stravaAppsUrl: STRAVA_APPS_URL,
    })
  } catch (err: any) {
    console.error('strava disconnect error:', err)
    return NextResponse.json({ error: err?.message || 'Disconnect failed' }, { status: 500 })
  }
}
