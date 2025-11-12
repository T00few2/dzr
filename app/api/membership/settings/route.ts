import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const doc = await adminDb.collection('system_settings').doc('global').get()
    const base = (doc.exists ? doc.data() : {}) as any
    const membership = base?.membership || {}
    const out = {
      minAmountDkk: Number(membership?.minAmountDkk ?? 10),
      maxAmountDkk: Number(membership?.maxAmountDkk ?? 100),
      dualYearMode: Boolean(membership?.dualYearMode ?? true),
      clubMemberRoleId: typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''
    }
    return NextResponse.json(out, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load settings' }, { status: 500 })
  }
}


