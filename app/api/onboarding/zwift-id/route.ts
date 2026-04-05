import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { getOnboardingSessionFromRequest, updateOnboardingSession } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeZwiftId(input: unknown): string {
  const raw = String(input ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits
}

export async function POST(req: Request) {
  try {
    const onboarding = await getOnboardingSessionFromRequest(req)
    if (!onboarding) return NextResponse.json({ error: 'Missing onboarding session' }, { status: 401 })
    if (!onboarding.session.discordId) return NextResponse.json({ error: 'Discord profile is not linked' }, { status: 400 })
    if (!onboarding.session.steps?.paymentSucceeded) {
      return NextResponse.json({ error: 'Payment must be completed before adding Zwift ID' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({} as any))
    const zwiftId = normalizeZwiftId(body?.zwiftId)
    if (!zwiftId || !/^\d{4,12}$/.test(zwiftId)) {
      return NextResponse.json({ error: 'Invalid Zwift ID format' }, { status: 400 })
    }

    const discordId = String(onboarding.session.discordId)
    const now = new Date().toISOString()
    await adminDb.collection('users').doc(discordId).set({
      discordId,
      username: onboarding.session.discordUsername || null,
      email: onboarding.session.discordEmail || null,
      zwiftId,
      zwiftLinkedAt: now,
      updatedAt: now,
    }, { merge: true })

    await updateOnboardingSession(onboarding.sessionId, {
      zwiftId,
      zwiftLinkedAt: now,
      status: 'completed',
      steps: {
        discordLinked: Boolean(onboarding.session.steps?.discordLinked),
        paymentSucceeded: Boolean(onboarding.session.steps?.paymentSucceeded),
        zwiftLinked: true,
      },
    })

    return NextResponse.json({ success: true, zwiftId }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save Zwift ID' }, { status: 500 })
  }
}
