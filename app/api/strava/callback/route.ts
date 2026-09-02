import { NextResponse } from 'next/server'
import { admin, adminDb } from '@/app/utils/firebaseAdminConfig'
import { sendDm } from '@/app/api/admin/_lib/discord'
import {
  getStravaClientId,
  getStravaClientSecret,
  getStravaRedirectUri,
  hasClubMemberRole,
  STRAVA_CONNECTIONS_COLLECTION,
  verifySignedToken,
} from '@/app/lib/stravaAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorRedirect(req: Request, reason: string) {
  const url = new URL('/strava/error', req.url)
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: Request) {
  try {
    const clientId = getStravaClientId()
    const clientSecret = getStravaClientSecret()
    if (!clientId || !clientSecret) return errorRedirect(req, 'missing_strava_env')

    const url = new URL(req.url)
    const error = url.searchParams.get('error')
    if (error) return errorRedirect(req, error === 'access_denied' ? 'denied' : 'strava_error')

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return errorRedirect(req, 'missing_code')

    const verified = verifySignedToken(state)
    if (!verified?.discordId) return errorRedirect(req, 'invalid_or_expired_link')
    const discordId = verified.discordId

    if (!(await hasClubMemberRole(discordId))) {
      return errorRedirect(req, 'not_club_member')
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    const tokenBody = await tokenRes.json().catch(() => null)
    if (!tokenRes.ok || !tokenBody?.access_token || !tokenBody?.refresh_token) {
      console.error('strava token exchange failed', tokenRes.status, tokenBody)
      return errorRedirect(req, 'token_exchange_failed')
    }

    const athlete = tokenBody.athlete || {}
    const athleteId = athlete.id
    if (!athleteId) return errorRedirect(req, 'token_exchange_failed')

    const now = admin.firestore.FieldValue.serverTimestamp()
    await adminDb.collection(STRAVA_CONNECTIONS_COLLECTION).doc(discordId).set({
      discordId,
      athleteId: Number(athleteId),
      accessToken: String(tokenBody.access_token),
      refreshToken: String(tokenBody.refresh_token),
      expiresAt: Number(tokenBody.expires_at) || Math.floor(Date.now() / 1000) + 20000,
      scopes: String(tokenBody.scope || ''),
      athleteFirstname: athlete.firstname || null,
      athleteLastname: athlete.lastname || null,
      consentAt: now,
      connectedAt: now,
      updatedAt: now,
    })

    try {
      await sendDm(
        discordId,
        '✅ **Strava er forbundet.**\n\n' +
          'Spørg mig om din træning her i DM — fx:\n' +
          '• Hvordan var min uge?\n' +
          '• Var i går for hård?\n' +
          '• Skal jeg hvile i morgen?\n\n' +
          'I only use *your* Strava data, and this chat stays private.'
      )
    } catch (dmErr) {
      console.warn('strava callback: could not DM user', discordId, dmErr)
    }

    return NextResponse.redirect(new URL('/strava/connected', req.url))
  } catch (err: any) {
    console.error('strava callback error:', err)
    return errorRedirect(req, 'callback_failed')
  }
}
