import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { applyOnboardingCookie, ensureOnboardingSession, pickUtm, updateOnboardingSession } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getBaseUrl(req: Request): string {
  const envUrl = String(process.env.NEXTAUTH_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

function getDiscordOnboardingRedirectUri(req: Request): string {
  const explicit = String(process.env.DISCORD_ONBOARDING_REDIRECT_URI || '').trim()
  if (explicit) return explicit
  return `${getBaseUrl(req)}/api/onboarding/discord/callback`
}

export async function GET(req: Request) {
  try {
    const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim()
    if (!clientId) {
      return NextResponse.json({ error: 'Missing DISCORD_CLIENT_ID' }, { status: 500 })
    }

    const params = new URL(req.url).searchParams
    const utm = pickUtm(Object.fromEntries(params.entries()))
    const ensured = await ensureOnboardingSession(req, utm)
    const oauthState = crypto.randomUUID()
    await updateOnboardingSession(ensured.sessionId, {
      oauth: {
        state: oauthState,
        createdAt: new Date().toISOString(),
      },
    })

    const redirectUri = getDiscordOnboardingRedirectUri(req)
    const authorizeUrl = new URL('https://discord.com/oauth2/authorize')
    authorizeUrl.searchParams.set('client_id', clientId)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('scope', 'identify email guilds.join')
    authorizeUrl.searchParams.set('prompt', 'consent')
    authorizeUrl.searchParams.set('state', oauthState)

    const res = NextResponse.redirect(authorizeUrl.toString())
    applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to start onboarding Discord OAuth' }, { status: 500 })
  }
}
