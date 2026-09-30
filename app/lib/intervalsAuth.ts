import crypto from 'node:crypto'
import { COLLECTIONS, SITE_ORIGIN } from '@/app/lib/sharedConstants'
import { isPaidClubMember as sharedIsPaidClubMember } from '@/packages/shared/coach/membership'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const INTERVALS_SCOPES = 'ACTIVITY:READ,WELLNESS:READ,SETTINGS:READ,CALENDAR:WRITE'
export const INTERVALS_CONNECTIONS_COLLECTION =
  COLLECTIONS.intervalsConnections || 'intervals_connections'
export const INTERVALS_APPS_URL = 'https://intervals.icu/settings'
export const CONNECT_TOKEN_TTL_MS = 15 * 60 * 1000
export const OAUTH_STATE_TTL_MS = 20 * 60 * 1000

type SignedPayload = { d: string; e: number }

export function connectSecret(): string {
  return String(process.env.COACH_CONNECT_SECRET || '').trim()
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
  if (!secret) throw new Error('COACH_CONNECT_SECRET is not set')
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

export function getIntervalsClientId(): string {
  return String(process.env.INTERVALS_CLIENT_ID || '').trim()
}

export function getIntervalsClientSecret(): string {
  return String(process.env.INTERVALS_CLIENT_SECRET || '').trim()
}

export function getBaseUrl(req: Request): string {
  const envUrl = String(process.env.NEXTAUTH_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

export function getIntervalsRedirectUri(req: Request): string {
  const explicit = String(process.env.INTERVALS_REDIRECT_URI || '').trim()
  if (explicit) return explicit
  return `${getBaseUrl(req)}/api/intervals/callback`
}

export function siteOrigin(): string {
  const envUrl = String(process.env.NEXTAUTH_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  return SITE_ORIGIN
}

export function intervalsAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL('https://intervals.icu/oauth/authorize')
  url.searchParams.set('client_id', opts.clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INTERVALS_SCOPES)
  url.searchParams.set('state', opts.state)
  return url.toString()
}

export async function isPaidClubMember(discordId: string): Promise<boolean> {
  return sharedIsPaidClubMember(
    adminDb,
    { memberships: COLLECTIONS.memberships, payments: COLLECTIONS.payments },
    discordId
  )
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
