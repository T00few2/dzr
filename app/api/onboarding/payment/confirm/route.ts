import { NextResponse } from 'next/server'
import { getOnboardingSessionFromRequest } from '@/app/api/onboarding/_lib/session'
import { processOnboardingPayment } from '@/app/api/onboarding/_lib/payment'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const onboarding = await getOnboardingSessionFromRequest(req)
    if (!onboarding) return NextResponse.json({ error: 'Missing onboarding session' }, { status: 401 })

    const reference = String(new URL(req.url).searchParams.get('reference') || '').trim()
    if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

    const result = await processOnboardingPayment(reference, onboarding.sessionId)
    if (result.status === 'forbidden') return NextResponse.json({ error: 'Payment does not belong to onboarding session' }, { status: 403 })
    if (result.status === 'not_found') return NextResponse.json({ error: 'Payment reference not found' }, { status: 404 })

    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to confirm onboarding payment' }, { status: 500 })
  }
}
