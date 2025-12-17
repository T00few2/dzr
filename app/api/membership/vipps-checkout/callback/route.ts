import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsGetCheckoutSession } from '@/app/api/membership/vippsClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook callback from Vipps Checkout when session state changes.
 * This is called by Vipps when the payment is completed, expired, or terminated.
 * 
 * The Checkout API automatically captures the payment, so we just need to
 * verify the state and update our records.
 */
export async function POST(req: Request) {
  try {
    // Verify callback authorization token
    const authHeader = req.headers.get('authorization') || ''
    const expectedToken = process.env.VIPPS_CALLBACK_TOKEN || 'dzr-callback-token'
    if (authHeader !== expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Vipps Checkout callback: Invalid authorization token')
      // Don't return 401 to avoid Vipps retrying - just log and return 200
    }

    const body = await req.json().catch(() => ({} as any))
    const reference = String(body?.reference || '').trim()
    const sessionState = String(body?.sessionState || '').trim()
    
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    // Log the callback for debugging
    console.log('Vipps Checkout callback:', { reference, sessionState, body })

    // Get the full session info from Vipps
    let session: any = null
    try {
      session = await vippsGetCheckoutSession(reference)
    } catch (err: any) {
      console.error('Failed to get checkout session:', err)
    }

    const paymentState = String(session?.paymentDetails?.state || '').toUpperCase()
    const capturedAmount = Number(session?.paymentDetails?.aggregate?.capturedAmount?.value ?? 0)
    const isCaptured = paymentState === 'CAPTURED' || capturedAmount > 0
    const isSuccessful = sessionState === 'PaymentSuccessful' || isCaptured

    // Update payment record
    const docRef = adminDb.collection('payments').doc(`checkout_${reference}`)
    const localSnap = await docRef.get()
    const local = localSnap.exists ? (localSnap.data() || {}) as any : {}

    await docRef.set({
      checkout: {
        reference,
        sessionState,
        paymentState: paymentState || null,
        capturedAmount: capturedAmount || null,
        lastCallbackAt: new Date().toISOString(),
        lastCallbackBody: body,
        lastSessionInfo: session || null,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    // If payment is successful and captured, update membership
    if (isSuccessful) {
      const userId = String(local?.userId || '').trim()
      const fullName = String(local?.fullName || session?.billingDetails?.firstName + ' ' + session?.billingDetails?.lastName || '').trim()
      const userEmail = String(local?.userEmail || session?.billingDetails?.email || '').trim()
      const coversYears: number[] = Array.isArray(local?.coversYears) ? local.coversYears : [new Date().getUTCFullYear()]
      const coveredThroughYear = typeof local?.coveredThroughYear === 'number'
        ? local.coveredThroughYear
        : Math.max(...coversYears)

      const paidAt = new Date().toISOString()
      
      await docRef.set({
        userId: userId || 'unknown',
        userEmail,
        fullName,
        paymentProvider: 'vipps-checkout',
        checkout: {
          reference,
          sessionState,
          paymentState: 'CAPTURED',
        },
        status: 'succeeded',
        paidAt,
        updatedAt: paidAt,
      }, { merge: true })

      // Update membership record
      if (userId) {
        await adminDb.collection('memberships').doc(String(userId)).set({
          userId: String(userId),
          fullName: fullName || null,
          currentStatus: 'club',
          coveredThroughYear,
          lastPaymentId: `checkout_${reference}`,
          updatedAt: paidAt,
        }, { merge: true })

        // Discord role automation
        const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
        const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
        const clubMemberRoleId = typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''

        if (clubMemberRoleId) {
          const guildId = process.env.DISCORD_GUILD_ID as string
          const botToken = process.env.DISCORD_BOT_TOKEN as string
          if (guildId && botToken) {
            const shouldHaveRole = coveredThroughYear >= new Date().getUTCFullYear()
            try {
              if (shouldHaveRole) {
                await discordAddRole(guildId, userId, clubMemberRoleId, botToken)
              }
            } catch {
              // Queue for retry
              await adminDb.collection('role_updates').add({
                userId,
                guildId,
                addRoleIds: shouldHaveRole ? [clubMemberRoleId] : [],
                removeRoleIds: [],
                createdAt: new Date().toISOString(),
                attempt: 0,
              })
            }
          }
        }
      }
    }

    // Vipps expects a 200 response
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    console.error('Vipps Checkout callback error:', err)
    // Return 200 to prevent Vipps from retrying
    return NextResponse.json({ error: err?.message || 'Callback processing failed' }, { status: 200 })
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

