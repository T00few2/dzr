import { NextResponse } from 'next/server'
import { admin, adminDb } from '@/app/utils/firebaseAdminConfig'
import { sendCoachDm } from '@/app/api/admin/_lib/discord'
import {
  getIntervalsClientId,
  getIntervalsClientSecret,
  getIntervalsRedirectUri,
  hasClubMemberRole,
  INTERVALS_CONNECTIONS_COLLECTION,
  verifySignedToken,
} from '@/app/lib/intervalsAuth'
import { INTERVALS_SETTINGS_URL } from '@/app/lib/intervalsCoachLinks'
import { canEncryptTokens, encryptedTokenFields } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorRedirect(req: Request, reason: string) {
  const url = new URL('/intervals/error', req.url)
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: Request) {
  try {
    const clientId = getIntervalsClientId()
    const clientSecret = getIntervalsClientSecret()
    if (!clientId || !clientSecret) return errorRedirect(req, 'missing_intervals_env')

    const url = new URL(req.url)
    const error = url.searchParams.get('error')
    if (error) return errorRedirect(req, error === 'access_denied' ? 'denied' : 'intervals_error')

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return errorRedirect(req, 'missing_code')

    const verified = verifySignedToken(state)
    if (!verified?.discordId) return errorRedirect(req, 'invalid_or_expired_link')
    const discordId = verified.discordId

    if (!(await hasClubMemberRole(discordId))) {
      return errorRedirect(req, 'not_club_member')
    }

    const tokenRes = await fetch('https://intervals.icu/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
      cache: 'no-store',
    })
    const tokenBody = await tokenRes.json().catch(() => null)
    if (!tokenRes.ok || !tokenBody?.access_token) {
      console.error('intervals token exchange failed', tokenRes.status, tokenBody)
      return errorRedirect(req, 'token_exchange_failed')
    }

    const athlete = tokenBody.athlete || {}
    const athleteId = athlete.id
    if (!athleteId) return errorRedirect(req, 'token_exchange_failed')
    const name = String(athlete.name || '').trim()
    const [firstname, ...rest] = name.split(/\s+/).filter(Boolean)

    const now = admin.firestore.FieldValue.serverTimestamp()
    const accessToken = String(tokenBody.access_token)
    const doc: Record<string, unknown> = {
      discordId,
      athleteId: String(athleteId),
      scopes: String(tokenBody.scope || ''),
      athleteName: name || null,
      athleteFirstname: firstname || null,
      athleteLastname: rest.join(' ') || null,
      consentAt: now,
      connectedAt: now,
      updatedAt: now,
      ...encryptedTokenFields(accessToken, ''),
    }
    await adminDb.collection(INTERVALS_CONNECTIONS_COLLECTION).doc(discordId).set(doc)

    try {
      await sendCoachDm(
        discordId,
        '✅ **intervals.icu er forbundet.**\n\n' +
          'For at coachen kan se dine ture og lægge pas ind i Zwift:\n' +
          '1. Settings → Connections: forbind **Zwift** direkte, og slå upload af planlagte workouts til.\n' +
          '2. Sæt den **samme FTP** på Zwift og på intervals.icu.\n' +
          '3. Udendørs ture: forbind Garmin, Wahoo, Polar eller Coros direkte. Ture, der kun kommer fra Strava-API\'en, kan ikke læses.\n' +
          `Indstillinger: <${INTERVALS_SETTINGS_URL}>\n\n` +
          'Spørg **DZR Coach** her i DM — fx:\n' +
          '• Hvordan var min uge?\n' +
          '• Var i går for hård?\n' +
          '• Skal jeg hvile i morgen?'
      )
    } catch (dmErr) {
      console.warn('intervals callback: could not DM user', discordId, dmErr)
    }

    return NextResponse.redirect(new URL('/intervals/connected', req.url))
  } catch (err: any) {
    console.error('intervals callback error:', err)
    return errorRedirect(req, 'callback_failed')
  }
}
