import { NextResponse } from 'next/server'
import { findDiscordIdByStravaAthleteId, wipeCoachStravaForDiscordId } from '@/app/lib/wipeCoachStrava'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function verifyToken() {
  return String(process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || '').trim()
}

/** Strava subscription validation: GET with hub.mode, hub.verify_token, hub.challenge */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = verifyToken()
  if (!expected || mode !== 'subscribe' || token !== expected || !challenge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ 'hub.challenge': challenge })
}

/** athlete update with authorized=false means the user revoked the app in Strava. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const objectType = String(body?.object_type || '')
    const aspect = String(body?.aspect_type || '')
    const authorized = String(body?.updates?.authorized ?? '')
    const ownerId = Number(body?.owner_id)

    if (objectType === 'athlete' && aspect === 'update' && authorized === 'false') {
      const discordId = await findDiscordIdByStravaAthleteId(ownerId)
      if (discordId) {
        await wipeCoachStravaForDiscordId(discordId, { revokeOnStrava: false, notifyUser: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('strava webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
