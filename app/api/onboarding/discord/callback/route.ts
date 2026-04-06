import { NextResponse } from 'next/server'
import { applyOnboardingCookie, getOnboardingSessionFromRequest, updateOnboardingSession } from '@/app/api/onboarding/_lib/session'
import { syncMemberRoleOnLogin } from '@/app/utils/discordRoleSync'

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

function redirectWithError(req: Request, errorCode: string) {
  const url = new URL('/join/discord', getBaseUrl(req))
  url.searchParams.set('error', errorCode)
  return NextResponse.redirect(url.toString())
}

export async function GET(req: Request) {
  try {
    const ensured = await getOnboardingSessionFromRequest(req)
    if (!ensured) return redirectWithError(req, 'missing_session')

    const reqUrl = new URL(req.url)
    const code = String(reqUrl.searchParams.get('code') || '').trim()
    const state = String(reqUrl.searchParams.get('state') || '').trim()
    if (!code || !state) return redirectWithError(req, 'missing_code_or_state')

    const expectedState = String((ensured.session as any)?.oauth?.state || '').trim()
    if (!expectedState || state !== expectedState) return redirectWithError(req, 'state_mismatch')

    const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim()
    const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim()
    if (!clientId || !clientSecret) return redirectWithError(req, 'missing_discord_oauth_env')

    const redirectUri = getDiscordOnboardingRedirectUri(req)
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    })
    if (!tokenRes.ok) return redirectWithError(req, 'token_exchange_failed')

    const tokenData = await tokenRes.json()
    const accessToken = String(tokenData?.access_token || '').trim()
    if (!accessToken) return redirectWithError(req, 'missing_access_token')

    const meRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!meRes.ok) return redirectWithError(req, 'discord_profile_fetch_failed')

    const me = await meRes.json()
    const discordId = String(me?.id || '').trim()
    const username = String(me?.global_name || me?.username || '').trim()
    const email = String(me?.email || '').trim()
    if (!discordId) return redirectWithError(req, 'missing_discord_id')

    const guildId = String(process.env.DISCORD_GUILD_ID || '').trim()
    const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim()
    if (guildId && botToken) {
      const joinRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      })
      if (!joinRes.ok && joinRes.status !== 204) {
        const joinErr = await joinRes.text().catch(() => '')
        console.error(`[onboarding] guild join failed: status=${joinRes.status} body=${joinErr}`)
      }
    } else {
      console.warn('[onboarding] guild join skipped: missing DISCORD_GUILD_ID or DISCORD_BOT_TOKEN')
    }

    await updateOnboardingSession(ensured.sessionId, {
      discordId,
      discordUsername: username || null,
      discordEmail: email || null,
      autoLinkDisabled: false,
      steps: {
        ...(ensured.session.steps || {}),
        discordLinked: true,
      },
      discordLinkedAt: new Date().toISOString(),
      oauth: null,
    })

    const memberRoleSync = await syncMemberRoleOnLogin({
      userId: discordId,
      source: 'onboarding-discord-login',
    })
    await updateOnboardingSession(ensured.sessionId, { memberRoleSync })

    const nextUrl = new URL('/join/payment', getBaseUrl(req))
    const res = NextResponse.redirect(nextUrl.toString())
    applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
    return res
  } catch {
    return redirectWithError(req, 'unexpected_error')
  }
}
