import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const ONBOARDING_COOKIE_NAME = 'dzr_onboarding_session'
const ONBOARDING_SESSION_TTL_MS = 1000 * 60 * 60 * 24
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

type OnboardingSession = {
  sessionId: string
  status: 'in_progress' | 'completed' | 'expired'
  discordId: string | null
  discordUsername: string | null
  discordEmail: string | null
  utm: Record<string, string>
  steps: {
    discordLinked: boolean
    paymentSucceeded: boolean
    zwiftLinked: boolean
  }
  paymentReference: string | null
  zwiftId: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
}

function getSessionSecret(): string {
  const secret = process.env.ONBOARDING_SESSION_SECRET || process.env.NEXTAUTH_SECRET || ''
  if (!secret) throw new Error('Missing ONBOARDING_SESSION_SECRET or NEXTAUTH_SECRET')
  return secret
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function signPayload(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';').map((s) => s.trim())
  const match = parts.find((p) => p.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

export function pickUtm(input: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = input?.[key]
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim().slice(0, 200)
    }
  }
  return out
}

function buildCookieValue(sessionId: string, expiresAtIso: string): string {
  const payload = JSON.stringify({ sid: sessionId, exp: Date.parse(expiresAtIso) })
  const payloadB64 = base64UrlEncode(payload)
  const sig = signPayload(payloadB64, getSessionSecret())
  return `${payloadB64}.${sig}`
}

function parseCookieValue(cookieValue: string): { sid: string; exp: number } | null {
  const [payloadB64, sig] = cookieValue.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64, getSessionSecret())
  if (sig.length !== expected.length) return null
  const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!valid) return null
  const payload = JSON.parse(base64UrlDecode(payloadB64)) as { sid?: string; exp?: number }
  if (!payload?.sid || typeof payload.exp !== 'number') return null
  return { sid: payload.sid, exp: payload.exp }
}

export function applyOnboardingCookie(res: NextResponse, cookieValue: string, expiresAtIso: string) {
  res.cookies.set({
    name: ONBOARDING_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAtIso),
  })
}

export async function createOnboardingSession(utm: Record<string, string> = {}) {
  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ONBOARDING_SESSION_TTL_MS).toISOString()
  const doc: OnboardingSession = {
    sessionId,
    status: 'in_progress',
    discordId: null,
    discordUsername: null,
    discordEmail: null,
    utm,
    steps: {
      discordLinked: false,
      paymentSucceeded: false,
      zwiftLinked: false,
    },
    paymentReference: null,
    zwiftId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  }
  await adminDb.collection('onboarding_sessions').doc(sessionId).set(doc, { merge: false })
  return { sessionId, session: doc, cookieValue: buildCookieValue(sessionId, expiresAt) }
}

export async function getOnboardingSessionFromRequest(req: Request) {
  const cookieValue = readCookie(req.headers.get('cookie'), ONBOARDING_COOKIE_NAME)
  if (!cookieValue) return null
  const parsed = parseCookieValue(cookieValue)
  if (!parsed) return null
  if (Date.now() > parsed.exp) return null
  const snap = await adminDb.collection('onboarding_sessions').doc(parsed.sid).get()
  if (!snap.exists) return null
  const data = snap.data() as OnboardingSession
  if (!data || Date.now() > Date.parse(data.expiresAt)) return null
  return {
    sessionId: parsed.sid,
    cookieValue,
    session: data,
  }
}

export async function ensureOnboardingSession(req: Request, utm: Record<string, string> = {}) {
  const existing = await getOnboardingSessionFromRequest(req)
  if (!existing) {
    return createOnboardingSession(utm)
  }
  if (Object.keys(utm).length) {
    await adminDb.collection('onboarding_sessions').doc(existing.sessionId).set({
      utm: { ...(existing.session.utm || {}), ...utm },
      updatedAt: new Date().toISOString(),
    }, { merge: true })
    existing.session.utm = { ...(existing.session.utm || {}), ...utm }
  }
  return existing
}

export async function updateOnboardingSession(sessionId: string, patch: Record<string, any>) {
  await adminDb.collection('onboarding_sessions').doc(sessionId).set({
    ...patch,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}
