import { NextResponse } from 'next/server'
import { applyOnboardingCookie, ensureOnboardingSession, updateOnboardingSession } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const ensured = await ensureOnboardingSession(req)
    const steps = ensured.session.steps || { discordLinked: false, paymentSucceeded: false, zwiftLinked: false }

    if (steps.paymentSucceeded || steps.zwiftLinked) {
      const res = NextResponse.json(
        { error: 'Cannot remove linked Discord profile after payment/zwift steps are completed.' },
        { status: 409 }
      )
      applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
      return res
    }

    await updateOnboardingSession(ensured.sessionId, {
      discordId: null,
      discordUsername: null,
      discordEmail: null,
      discordLinkedAt: null,
      oauth: null,
      steps: {
        ...steps,
        discordLinked: false,
      },
    })

    const res = NextResponse.json({ unlinked: true }, { status: 200 })
    applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to remove linked Discord profile' }, { status: 500 })
  }
}
