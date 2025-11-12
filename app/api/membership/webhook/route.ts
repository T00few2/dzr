import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY as string
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string
    if (!stripeSecret || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })

    const rawBody = await req.text()
    const sig = req.headers.get('stripe-signature') as string
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const piId = (session.payment_intent as string) || ''
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId)
        await handleSuccessfulPayment(stripe, pi, session)
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      await handleSuccessfulPayment(stripe, pi, null)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleSuccessfulPayment(stripe: Stripe, pi: Stripe.PaymentIntent, session: Stripe.Checkout.Session | null) {
  const metadata = (pi.metadata || {}) as Record<string, string>
  const userId = metadata.userId || 'unknown'
  const fullName = metadata.fullName || ''
  const userEmail = metadata.userEmail || (session?.customer_details?.email || '')
  const amount = (pi.amount_received ?? pi.amount ?? 0) / 100
  const currency = (pi.currency || 'dkk').toUpperCase()
  const paidAt = new Date().toISOString()

  let receiptUrl = ''
  try {
    const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 })
    receiptUrl = charges.data[0]?.receipt_url || ''
  } catch {}

  // Load settings
  const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
  const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
  const dualYearMode = Boolean(membership?.dualYearMode ?? true)
  const clubMemberRoleId = typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const coversYears = dualYearMode ? [currentYear, currentYear + 1] : [currentYear]
  const coveredThroughYear = Math.max(...coversYears)

  // Store payment record
  const paymentsCol = adminDb.collection('payments')
  await paymentsCol.doc(String(pi.id)).set({
    userId,
    userEmail,
    fullName,
    amountDkk: amount,
    currency,
    paymentProvider: 'stripe',
    stripe: {
      paymentIntentId: pi.id,
      customerId: typeof pi.customer === 'string' ? pi.customer : (pi.customer as any)?.id || '',
      paymentMethod: (pi.payment_method_types || [])[0] || '',
      receiptUrl: receiptUrl,
    },
    status: 'succeeded',
    paidAt,
    coversYears,
    coveredThroughYear,
    createdAt: new Date().toISOString(),
  }, { merge: true })

  // Update membership summary
  const membershipDoc = adminDb.collection('memberships').doc(String(userId))
  await membershipDoc.set({
    userId,
    fullName: fullName || null,
    currentStatus: 'club',
    coveredThroughYear,
    lastPaymentId: pi.id,
    updatedAt: new Date().toISOString(),
  }, { merge: true })

  // Discord role automation (add if covered, otherwise remove)
  if (clubMemberRoleId) {
    const guildId = process.env.DISCORD_GUILD_ID as string
    const botToken = process.env.DISCORD_BOT_TOKEN as string
    if (guildId && botToken && userId) {
      // Try to add role now; if it fails, enqueue a request
      const shouldHaveRole = coveredThroughYear >= new Date().getUTCFullYear()
      try {
        if (shouldHaveRole) {
          await discordAddRole(guildId, userId, clubMemberRoleId, botToken)
        } else {
          await discordRemoveRole(guildId, userId, clubMemberRoleId, botToken)
        }
      } catch {
        await adminDb.collection('role_updates').add({
          userId,
          guildId,
          addRoleIds: shouldHaveRole ? [clubMemberRoleId] : [],
          removeRoleIds: shouldHaveRole ? [] : [clubMemberRoleId],
          createdAt: new Date().toISOString(),
          attempt: 0,
        })
      }
    }
  }
}

async function discordAddRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) {
    throw new Error(`Failed to add role: ${resp.status}`)
  }
}

async function discordRemoveRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) {
    throw new Error(`Failed to remove role: ${resp.status}`)
  }
}


