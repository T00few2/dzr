import { NextResponse } from 'next/server'
import { resolvePaymentOptions, usesPaymentOptionFallback } from '@/app/lib/membershipPaymentOptions'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const doc = await adminDb.collection('system_settings').doc('global').get()
    const base = (doc.exists ? doc.data() : {}) as any
    const membership = base?.membership || {}
    if (usesPaymentOptionFallback(membership?.paymentOptions)) {
      console.error('[membership] paymentOptions missing; join is using the current-year fallback')
    }
    const out = {
      minAmountDkk: Number(membership?.minAmountDkk ?? 10),
      maxAmountDkk: Number(membership?.maxAmountDkk ?? 100),
      clubMemberRoleId: typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : '',
      paymentOptions: resolvePaymentOptions(membership?.paymentOptions),
    }
    return NextResponse.json(out, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load settings' }, { status: 500 })
  }
}


