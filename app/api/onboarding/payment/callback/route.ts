import { NextResponse } from 'next/server'
import { processOnboardingPayment } from '@/app/api/onboarding/_lib/payment'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const expectedToken = process.env.VIPPS_CALLBACK_TOKEN || 'dzr-callback-token'
    if (authHeader !== expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      // Always return 200 to avoid Vipps retry storms.
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const body = await req.json().catch(() => ({} as any))
    const reference = String(body?.reference || '').trim()
    if (!reference) return NextResponse.json({ received: true }, { status: 200 })

    await processOnboardingPayment(reference)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch {
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
