import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { applyOnboardingCookie, ensureOnboardingSession, updateOnboardingSession } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const ensured = await ensureOnboardingSession(req)
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })

    if (!token || !(token as any)?.discordId) {
      const res = NextResponse.json({ linked: false }, { status: 200 })
      applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
      return res
    }

    const discordId = String((token as any).discordId || '').trim()
    const discordEmail = String((token as any).email || '').trim()
    const discordUsername = String((token as any).name || '').trim()

    await updateOnboardingSession(ensured.sessionId, {
      discordId,
      discordEmail: discordEmail || null,
      discordUsername: discordUsername || null,
      steps: {
        ...(ensured.session.steps || {}),
        discordLinked: true,
      },
      discordLinkedAt: new Date().toISOString(),
    })

    const res = NextResponse.json({ linked: true, discordId }, { status: 200 })
    applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to link Discord from session' }, { status: 500 })
  }
}
