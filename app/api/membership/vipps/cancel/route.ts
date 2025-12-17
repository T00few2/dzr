import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCancelPayment, vippsGetPayment } from '@/app/api/membership/vippsClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = Boolean((token as any)?.isAdmin)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({} as any))
    const reference = String(body?.reference || '').trim()
    if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

    const payment = await vippsGetPayment(reference)
    const stateRaw = (payment as any)?.state
    const state = Array.isArray(stateRaw) ? String(stateRaw[0] || '').toUpperCase() : String(stateRaw || '').toUpperCase()
    const capturedAmount = Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) || 0
    const isCaptured = state === 'CAPTURED' || capturedAmount > 0
    if (isCaptured) {
      return NextResponse.json({ error: 'Cannot cancel a captured payment' }, { status: 409 })
    }

    try {
      await vippsCancelPayment(reference)
    } catch (err: any) {
      const msg = String(err?.message || '')
      // Vipps returns 6040 when trying to cancel a captured payment.
      if (msg.includes('"reason":"6040"') || msg.toLowerCase().includes('cannot cancel a captured payment')) {
        return NextResponse.json({ error: 'Cannot cancel a captured payment' }, { status: 409 })
      }
      throw err
    }
    const after = await vippsGetPayment(reference)
    const afterState = String((after as any)?.state || '').toUpperCase()

    await adminDb.collection('payments').doc(`vipps_${reference}`).set({
      vipps: { state: afterState || 'CANCELLED' },
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    return NextResponse.json({ reference, state: afterState || null, status: 'cancelled' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Cancel failed' }, { status: 500 })
  }
}


