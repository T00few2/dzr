import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCapturePayment, vippsGetPayment, vippsGetPaymentEvents } from '@/app/api/membership/vippsClient'

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

    const docRef = adminDb.collection('payments').doc(`vipps_${reference}`)
    const localSnap = await docRef.get()
    const local = localSnap.exists ? (localSnap.data() || {}) as any : {}

    let payment: any = await vippsGetPayment(reference)
    const stateRaw = (payment as any)?.state
    let state = Array.isArray(stateRaw) ? String(stateRaw[0] || '').toUpperCase() : String(stateRaw || '').toUpperCase()
    const capturedAmount0 = Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) || 0
    if (state === 'CAPTURED' || capturedAmount0 > 0) {
      return NextResponse.json({ reference, state: 'CAPTURED', status: 'captured' }, { status: 200 })
    }
    if (state !== 'AUTHORIZED') {
      return NextResponse.json({ error: `Cannot capture payment in state ${state || 'UNKNOWN'}` }, { status: 409 })
    }

    const currency = String((payment as any)?.amount?.currency || local?.currency || 'DKK').toUpperCase()

    const aggregateAuthorizedValue =
      Number((payment as any)?.aggregate?.authorizedAmount?.value ?? 0) ||
      Number((payment as any)?.aggregate?.reservedAmount?.value ?? 0) ||
      0
    const aggregateCapturedValue =
      Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) ||
      0
    const aggregateRemainingValue =
      aggregateAuthorizedValue > 0 ? Math.max(aggregateAuthorizedValue - aggregateCapturedValue, 0) : 0

    let authorizedValueFromEvents = 0
    try {
      const events = await vippsGetPaymentEvents(reference)
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i] as any
        const name = String(ev?.name || '').toUpperCase()
        const v = Number(ev?.amount?.value ?? 0)
        if ((name === 'AUTHORIZED' || name === 'RESERVED') && v > 0) {
          authorizedValueFromEvents = v
          break
        }
      }
    } catch {}

    const amountValueFromApi = Number((payment as any)?.amount?.value ?? 0)
    const amountDkkLocal = Number(local?.amountDkk ?? 0)
    const amountValueLocal = amountDkkLocal > 0 ? Math.round(amountDkkLocal * 100) : 0

    const candidates = Array.from(new Set([
      aggregateRemainingValue,
      authorizedValueFromEvents,
      amountValueFromApi,
      amountValueLocal,
    ].filter(v => typeof v === 'number' && v > 0))).sort((a, b) => a - b)

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Could not determine amount to capture' }, { status: 500 })
    }

    // Try capture smallest-first to avoid "capture amount too high"
    const attempts: Array<{ value: number; ok: boolean; err?: string }> = []
    let captured = false
    for (const value of candidates) {
      try {
        await vippsCapturePayment(reference, { modificationAmount: { currency, value } })
        attempts.push({ value, ok: true })
        captured = true
        break
      } catch (err: any) {
        attempts.push({ value, ok: false, err: String(err?.message || err) })
        const msg = String(err?.message || '').toLowerCase()
        if (!msg.includes('capture amount too high') && !msg.includes('6090')) break
      }
    }

    await docRef.set({
      vipps: {
        lastManualCaptureAt: new Date().toISOString(),
        lastManualCaptureCandidates: candidates,
        lastManualCaptureAttempts: attempts,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    // Re-check (Vipps may report captured via aggregates even if state string isn't updated as expected)
    payment = await vippsGetPayment(reference)
    const stateRaw2 = (payment as any)?.state
    state = Array.isArray(stateRaw2) ? String(stateRaw2[0] || '').toUpperCase() : String(stateRaw2 || '').toUpperCase()
    const capturedAmount1 = Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) || 0
    if (!captured || (state !== 'CAPTURED' && capturedAmount1 <= 0)) {
      const lastErr = attempts.find(a => !a.ok)?.err || ''
      return NextResponse.json({
        error: lastErr || 'Capture did not succeed',
        reference,
        state: state || null,
        status: 'not_captured',
        candidates,
        attempts,
      }, { status: 409 })
    }

    // Mark payment succeeded + update membership now that it's captured
    const metadata = ((payment as any)?.metadata || {}) as Record<string, string>
    const userId = String(local?.userId || metadata?.userId || '').trim()
    const fullName = String(local?.fullName || metadata?.fullName || '').trim()
    const userEmail = String(local?.userEmail || metadata?.userEmail || '').trim()

    const paidAt = new Date().toISOString()
    await docRef.set({
      userId: userId || 'unknown',
      userEmail,
      fullName,
      paymentProvider: 'vipps',
      vipps: {
        reference,
        pspReference: String((payment as any)?.pspReference || ''),
        state: 'CAPTURED',
      },
      status: 'succeeded',
      paidAt,
      updatedAt: paidAt,
    }, { merge: true })

    if (userId) {
      const coversYears: number[] = Array.isArray(local?.coversYears) ? local.coversYears : []
      const coveredThroughYear = typeof local?.coveredThroughYear === 'number'
        ? local.coveredThroughYear
        : (coversYears.length ? Math.max(...coversYears) : new Date().getUTCFullYear())

      await adminDb.collection('memberships').doc(String(userId)).set({
        userId: String(userId),
        fullName: fullName || null,
        currentStatus: 'club',
        coveredThroughYear,
        lastPaymentId: `vipps_${reference}`,
        updatedAt: paidAt,
      }, { merge: true })
    }

    return NextResponse.json({ reference, state: 'CAPTURED', status: 'captured' }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Capture failed' }, { status: 500 })
  }
}


