import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import {
  getIntervalsClientId,
  getIntervalsRedirectUri,
  hasClubMemberRole,
  intervalsAuthorizeUrl,
  mintSignedToken,
  OAUTH_STATE_TTL_MS,
  verifySignedToken,
} from '@/app/lib/intervalsAuth'

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
    if (!clientId) return errorRedirect(req, 'missing_intervals_env')

    const params = new URL(req.url).searchParams
    if (params.get('consent') !== '1') {
      const landing = new URL('/intervals/connect', req.url)
      const token = params.get('token')
      if (token) landing.searchParams.set('token', token)
      return NextResponse.redirect(landing)
    }

    let discordId: string | null = null
    const signed = params.get('token')
    if (signed) {
      const verified = verifySignedToken(signed)
      discordId = verified?.discordId || null
      if (!discordId) return errorRedirect(req, 'invalid_or_expired_link')
    } else {
      const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
      discordId = String((session as any)?.discordId || '').trim() || null
      if (!discordId) return errorRedirect(req, 'not_logged_in')
    }

    if (!(await hasClubMemberRole(discordId))) {
      return errorRedirect(req, 'not_club_member')
    }

    const state = mintSignedToken(discordId, OAUTH_STATE_TTL_MS)
    const authorizeUrl = intervalsAuthorizeUrl({
      clientId,
      redirectUri: getIntervalsRedirectUri(req),
      state,
    })
    return NextResponse.redirect(authorizeUrl)
  } catch (err: any) {
    console.error('intervals connect error:', err)
    return errorRedirect(req, 'connect_failed')
  }
}
