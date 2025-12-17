import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCreateCheckoutSession } from '@/app/api/membership/vippsClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Create a Vipps Checkout session for membership payment.
 * 
 * The Checkout API automatically handles capture when the payment is completed,
 * which works better for Danish/Finnish sales units where the ePayment API
 * capture can be problematic.
 * 
 * See: https://developer.vippsmobilepay.com/docs/APIs/checkout-api/
 */
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

    // Checkout reference must be unique and match ^[a-zA-Z0-9-]{8,64}$
    const referenceBase = `dzr-${String(userId).replace(/[^a-zA-Z0-9]/g, '') || 'user'}`
    const reference = `${referenceBase}-${Date.now()}`
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .slice(0, 64)
      .padEnd(8, '0')

    const siteUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const returnUrl = `${siteUrl}/members-zone/my-pages/membership?checkoutReference=${encodeURIComponent(reference)}`
    
    // Vipps requires HTTPS for callback URLs. In development (localhost), we need a real HTTPS URL.
    // Option 1: Set VIPPS_CALLBACK_URL env var to your ngrok/deployed URL
    // Option 2: Use a webhook testing service like webhook.site
    // The callback won't work in dev without a real URL, but the confirm endpoint handles it.
    const isHttps = siteUrl.startsWith('https://')
    const callbackUrl = process.env.VIPPS_CALLBACK_URL || (isHttps 
      ? `${siteUrl}/api/membership/vipps-checkout/callback`
      : `https://webhook.site/${reference}`) // Webhook.site for dev testing

    // Store a "created" payment record immediately
    await adminDb.collection('payments').doc(`checkout_${reference}`).set({
      userId: String(userId),
      userEmail: String(userEmail || ''),
      fullName: String(fullName),
      amountDkk: Number(amountDkk),
      currency: 'DKK',
      paymentProvider: 'vipps-checkout',
      checkout: {
        reference,
        state: 'CREATED',
      },
      status: 'created',
      coversYears: selected.coversYears,
      coveredThroughYear: Math.max(...selected.coversYears),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    // Split full name into first and last name for prefill
    const nameParts = fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Build merchantInfo - callbackUrl and token are always required by Vipps
    const merchantInfo = {
      returnUrl,
      callbackUrl,
      callbackAuthorizationToken: process.env.VIPPS_CALLBACK_TOKEN || 'dzr-callback-token',
    }

    const session = await vippsCreateCheckoutSession({
      type: 'PAYMENT',
      reference,
      transaction: {
        amount: { value: Math.round(amountDkk * 100), currency: 'DKK' },
        paymentDescription: `DZR Membership ${optionLabel}`,
      },
      merchantInfo,
      prefillCustomer: {
        firstName,
        lastName,
        email: userEmail || undefined,
      },
      configuration: {
        customerInteraction: 'CUSTOMER_PRESENT',
        // PaymentOnly for digital goods (no shipping needed)
        elements: 'PaymentOnly',
        countries: { supported: ['DK'] },
      },
    })
    
    console.log('Vipps Checkout session response:', JSON.stringify(session, null, 2))

    const checkoutFrontendUrl = session?.checkoutFrontendUrl || ''
    const sessionToken = session?.token || ''
    if (!checkoutFrontendUrl || !sessionToken) {
      return NextResponse.json({ error: 'Vipps Checkout did not return checkoutFrontendUrl or token' }, { status: 502 })
    }
    
    // Append token to the checkout URL - Vipps requires this for redirect flow
    const checkoutUrlWithToken = `${checkoutFrontendUrl}${checkoutFrontendUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(sessionToken)}`

    await adminDb.collection('payments').doc(`checkout_${reference}`).set({
      checkout: {
        reference,
        token: session.token || null,
        pollingUrl: session.pollingUrl || null,
        state: 'INITIATED',
      },
      status: 'initiated',
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    return NextResponse.json({ url: checkoutUrlWithToken, reference }, { status: 200 })
  } catch (err: any) {
    console.error('Vipps Checkout error:', err)
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 })
  }
}

