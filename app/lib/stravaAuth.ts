import crypto from 'node:crypto'
import { COLLECTIONS, SITE_ORIGIN } from '@/app/lib/sharedConstants'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const STRAVA_SCOPES = 'read,activity:read_all,profile:read_all'
export const STRAVA_CONNECTIONS_COLLECTION = COLLECTIONS.stravaConnections || 'strava_connections'
export const CONNECT_TOKEN_TTL_MS = 15 * 60 * 1000
export const OAUTH_STATE_TTL_MS = 20 * 60 * 1000

type SignedPayload = { d: string; e: number }

function connectSecret(): string {
  return String(process.env.STRAVA_CONNECT_SECRET || '').trim()
}

function hmac(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export function mintSignedToken(discordId: string, ttlMs = CONNECT_TOKEN_TTL_MS): string {
  const secret = connectSecret()
  if (!secret) throw new Error('STRAVA_CONNECT_SECRET is not set')
  const payload: SignedPayload = { d: String(discordId), e: Date.now() + ttlMs }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${hmac(body, secret)}`
}

export function verifySignedToken(token: string): { discordId: string } | null {
  const secret = connectSecret()
  if (!secret || !token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!body || !sig) return null
  if (!safeEqual(sig, hmac(body, secret))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedPayload
    if (!payload?.d || typeof payload.e !== 'number') return null
    if (payload.e < Date.now()) return null
    return { discordId: String(payload.d) }
  } catch {
    return null
  }
}

export function getStravaClientId(): string {
  return String(process.env.STRAVA_CLIENT_ID || '').trim()
}

export function getStravaClientSecret(): string {
  return String(process.env.STRAVA_CLIENT_SECRET || '').trim()
}

export function getBaseUrl(req: Request): string {
  const envUrl = String(process.env.NEXTAUTH_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

export function getStravaRedirectUri(req: Request): string {
  const explicit = String(process.env.STRAVA_REDIRECT_URI || '').trim()
  if (explicit) return explicit
  return `${getBaseUrl(req)}/api/strava/callback`
}

export function siteOrigin(): string {
  const envUrl = String(process.env.NEXTAUTH_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  return SITE_ORIGIN
}

export function stravaAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', opts.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', STRAVA_SCOPES)
  url.searchParams.set('state', opts.state)
  return url.toString()
}

/**
 * Paid DZR club membership for the current year (Vipps).
 * Verified Member / community Discord roles are not enough.
 */
export async function isPaidClubMember(discordId: string): Promise<boolean> {
  const id = String(discordId || '').trim()
  if (!id) return false
  const year = new Date().getUTCFullYear()
  try {
    const membershipSnap = await adminDb.collection(COLLECTIONS.memberships).doc(id).get()
    const membership = membershipSnap.exists ? membershipSnap.data() || {} : {}
    if (
      String(membership.currentStatus || '') === 'club' &&
      typeof membership.coveredThroughYear === 'number' &&
      membership.coveredThroughYear >= year
    ) {
      return true
    }

    const paymentsSnap = await adminDb
      .collection(COLLECTIONS.payments)
      .where('userId', '==', id)
      .where('status', '==', 'succeeded')
      .get()

    let maxCovered: number | null = null
    paymentsSnap.forEach((doc) => {
      const covered = doc.data()?.coveredThroughYear
      if (typeof covered === 'number' && (maxCovered == null || covered > maxCovered)) {
        maxCovered = covered
      }
    })
    return maxCovered != null && maxCovered >= year
  } catch (err) {
    console.error('isPaidClubMember failed', err)
    return false
  }
}

export async function hasClubMemberRole(discordId: string): Promise<boolean> {
  return isPaidClubMember(discordId)
}

export function toIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}
