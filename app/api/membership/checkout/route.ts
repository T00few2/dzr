import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import Stripe from 'stripe'

export async function POST(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = Boolean((token as any)?.isAdmin)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const amountDkk = Number(body?.amountDkk)
    const fullName = String(body?.fullName || '').trim()
    if (!amountDkk || amountDkk <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: 'Full name required' }, { status: 400 })

    const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
    const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
    const minAmount = Number(membership?.minAmountDkk ?? 10)
    const maxAmount = Number(membership?.maxAmountDkk ?? 100)
    if (amountDkk < minAmount || amountDkk > maxAmount) {
      return NextResponse.json({ error: `Amount must be between ${minAmount} and ${maxAmount} DKK` }, { status: 400 })
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY as string
    if (!stripeSecret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })

    const userId = (token as any)?.discordId || (token as any)?.sub || 'unknown'
    const userEmail = (token as any)?.email || undefined

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'dkk',
            product_data: { name: 'DZR Club Membership Fee' },
            unit_amount: Math.round(amountDkk * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(userId),
        fullName: String(fullName),
        userEmail: String(userEmail || ''),
      },
      payment_intent_data: {
        metadata: {
          userId: String(userId),
          fullName: String(fullName),
          userEmail: String(userEmail || ''),
        },
      },
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/members-zone/membership?status=success`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/members-zone/membership?status=cancelled`,
      customer_email: userEmail,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 })
  }
}


