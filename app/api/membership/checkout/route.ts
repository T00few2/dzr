import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCreatePayment } from '@/app/api/membership/vippsClient'

export async function POST(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = Boolean((token as any)?.isAdmin)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const amountDkk = Number(body?.amountDkk)
    const fullName = String(body?.fullName || '').trim()
    const selectedOptionId = String(body?.selectedOptionId || '').trim()
    if (!amountDkk || amountDkk <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: 'Full name required' }, { status: 400 })
    if (!selectedOptionId) return NextResponse.json({ error: 'Payment year selection required' }, { status: 400 })

    const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
    const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
    const minAmount = Number(membership?.minAmountDkk ?? 10)
    const maxAmount = Number(membership?.maxAmountDkk ?? 100)
    if (amountDkk < minAmount || amountDkk > maxAmount) {
      return NextResponse.json({ error: `Amount must be between ${minAmount} and ${maxAmount} DKK` }, { status: 400 })
    }
    const paymentOptions: Array<{ id: string; label?: string; coversYears?: number[] }> =
      Array.isArray(membership?.paymentOptions) ? membership.paymentOptions : []
    const selected = paymentOptions.find(o => String(o?.id || '') === selectedOptionId)
    if (!selected || !Array.isArray(selected.coversYears) || selected.coversYears.length === 0) {
      return NextResponse.json({ error: 'Invalid payment option' }, { status: 400 })
    }

    const userId = (token as any)?.discordId || (token as any)?.sub || 'unknown'
    const userEmail = (token as any)?.email || undefined

    const coversYearsCsv = selected.coversYears.join(',')
    const optionLabel = selected.label || selected.id
    // Vipps/MobilePay reference must match ^[a-zA-Z0-9-]{8,64}$ and be unique per MSN.
    const referenceBase = `dzr-${String(userId).replace(/[^a-zA-Z0-9]/g, '') || 'user'}`
    const reference = `${referenceBase}-${Date.now()}`
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .slice(0, 64)
      .padEnd(8, '0')

    const siteUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const returnUrl = `${siteUrl}/members-zone/my-pages/membership?vippsReference=${encodeURIComponent(reference)}`

    // Store a "created" payment record immediately (so we can reconcile even if the user never returns)
    await adminDb.collection('payments').doc(`vipps_${reference}`).set({
      userId: String(userId),
      userEmail: String(userEmail || ''),
      fullName: String(fullName),
      amountDkk: Number(amountDkk),
      currency: 'DKK',
      paymentProvider: 'vipps',
      vipps: {
        reference,
        state: 'CREATED',
      },
      status: 'created',
      coversYears: selected.coversYears,
      coveredThroughYear: Math.max(...selected.coversYears),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    const created = await vippsCreatePayment({
      amount: { currency: 'DKK', value: Math.round(amountDkk * 100) },
      reference,
      paymentMethod: { type: 'WALLET' },
      returnUrl,
      userFlow: 'WEB_REDIRECT',
      paymentDescription: 'DZR Club Membership Fee',
      metadata: {
        userId: String(userId),
        fullName: String(fullName),
        userEmail: String(userEmail || ''),
        coversYears: coversYearsCsv,
        optionLabel: String(optionLabel),
      },
    })

    const redirectUrl =
      (typeof (created as any)?.redirectUrl === 'string' && (created as any).redirectUrl) ||
      (typeof (created as any)?.url === 'string' && (created as any).url) ||
      ''
    if (!redirectUrl) {
      return NextResponse.json({ error: 'Vipps/MobilePay did not return a redirectUrl' }, { status: 502 })
    }

    await adminDb.collection('payments').doc(`vipps_${reference}`).set({
      vipps: {
        reference,
        pspReference: String((created as any)?.pspReference || ''),
        state: 'INITIATED',
      },
      status: 'initiated',
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    return NextResponse.json({ url: redirectUrl }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 })
  }
}


