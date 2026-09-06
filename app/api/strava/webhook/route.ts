import { NextResponse } from 'next/server'

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

/**
 * There is deliberately no POST handler.
 *
 * Strava sends event notifications by POST, but this app has no push subscription
 * (`GET /api/v3/push_subscriptions` returns `[]`), so no legitimate POST ever arrives here.
 * The previous handler authenticated nothing — Strava does not sign webhooks — and acted on
 * `owner_id`, a Strava athlete id that is public in every profile URL. Any unauthenticated
 * caller could therefore erase a named member's coach profile, all their chat notes and their
 * Strava connection.
 *
 * Deauthorisation is NOT handled here by design. A dead or revoked token surfaces as
 * `needs_reconnect` in apps/bot/services/stravaService.js, which means "ask them to
 * reauthorise" — often transient — and must not delete coach memory. Explicit disconnect on
 * the site (POST /api/strava/disconnect) is the only path that wipes coach data.
 *
 * The GET handler above is kept so a subscription can be registered later if wanted; it fails
 * closed while STRAVA_WEBHOOK_VERIFY_TOKEN is unset. If a subscription is ever created, do not
 * restore the old handler: give the callback an unguessable URL and verify `subscription_id`.
 */
