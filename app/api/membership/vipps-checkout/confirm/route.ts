import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsGetCheckoutSession, vippsCapturePayment } from '@/app/api/membership/vippsClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Confirm a Vipps Checkout payment after user returns from Vipps.
 * 
 * The Checkout API automatically captures payment, so we just need to
 * check the session state and update our records.
 */
export async function GET(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const callerUserId = String((token as any)?.discordId || (token as any)?.sub || '').trim()

    const { searchParams } = new URL(req.url)
    const reference = String(searchParams.get('reference') || '').trim()
    if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

    // Load local record
    const docRef = adminDb.collection('payments').doc(`checkout_${reference}`)
    const localSnap = await docRef.get()
    const local = localSnap.exists ? (localSnap.data() || {}) as any : {}

    // Get session info from Vipps
    let session: any = null
    try {
      session = await vippsGetCheckoutSession(reference)
    } catch (err: any) {
      // Session might not exist or be expired
      console.error('Failed to get checkout session:', err)
    }

    const sessionState = String(session?.sessionState || '').trim()
    let paymentState = String(session?.paymentDetails?.state || '').toUpperCase()
    let capturedAmount = Number(session?.paymentDetails?.aggregate?.capturedAmount?.value ?? 0)
    const authorizedAmount = Number(session?.paymentDetails?.aggregate?.authorizedAmount?.value ?? 0)
    const amountValue = Number(session?.paymentDetails?.amount?.value ?? 0)
    const currency = String(session?.paymentDetails?.amount?.currency || 'DKK').toUpperCase()

    // Auto-capture if payment is AUTHORIZED but not CAPTURED (Reserve Capture mode)
    if (paymentState === 'AUTHORIZED' && capturedAmount === 0 && (authorizedAmount > 0 || amountValue > 0)) {
      const captureAmount = authorizedAmount || amountValue
      console.log(`Auto-capturing payment ${reference} for amount ${captureAmount} ${currency}`)
      try {
        await vippsCapturePayment(reference, captureAmount, currency)
        paymentState = 'CAPTURED'
        capturedAmount = captureAmount
        console.log(`Auto-capture successful for ${reference}`)
      } catch (err: any) {
        console.error(`Auto-capture failed for ${reference}:`, err?.message || err)
        // Continue - user can retry or capture manually
      }
    }

    const isCaptured = paymentState === 'CAPTURED' || capturedAmount > 0
    const isSuccessful = sessionState === 'PaymentSuccessful' || isCaptured
    const isTerminalFail = sessionState === 'SessionExpired' || sessionState === 'PaymentTerminated' || paymentState === 'TERMINATED'

    // Update record with session info
    await docRef.set({
      checkout: {
        reference,
        sessionState: sessionState || null,
        paymentState: paymentState || null,
        capturedAmount: capturedAmount || null,
        lastConfirmAt: new Date().toISOString(),
        lastSessionInfo: session || null,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    if (!isSuccessful) {
      return NextResponse.json({
        reference,
        sessionState: sessionState || null,
        paymentState: paymentState || null,
        status: isTerminalFail ? 'failed' : 'pending',
      }, { status: 200 })
    }

    // Payment successful - update records
    const localUserId = String(local?.userId || '').trim()
    const userId = String(localUserId || callerUserId || '').trim()

    // Safety: ensure the payment is tied to the currently logged-in user
    if (callerUserId && localUserId && callerUserId !== localUserId) {
      return NextResponse.json({ error: 'Payment does not belong to current user' }, { status: 403 })
    }

    const billingDetails = session?.billingDetails || {}
    const fullName = String(
      local?.fullName || 
      `${billingDetails.firstName || ''} ${billingDetails.lastName || ''}`.trim() || 
      ''
    ).trim()
    const userEmail = String(local?.userEmail || billingDetails.email || '').trim()

    const amountValue = Number(session?.paymentDetails?.amount?.value ?? 0)
    const currency = String(session?.paymentDetails?.amount?.currency || local?.currency || 'DKK').toUpperCase()
    const amount = amountValue ? amountValue / 100 : Number(local?.amountDkk || 0)

    const coversYears: number[] = Array.isArray(local?.coversYears) ? local.coversYears : [new Date().getUTCFullYear()]
    const coveredThroughYear = typeof local?.coveredThroughYear === 'number'
      ? local.coveredThroughYear
      : Math.max(...coversYears)

    const paidAt = new Date().toISOString()

    // Store payment record
    await docRef.set({
      userId: userId || 'unknown',
      userEmail,
      fullName,
      amountDkk: amount,
      currency,
      paymentProvider: 'vipps-checkout',
      checkout: {
        reference,
        sessionState,
        paymentState: 'CAPTURED',
      },
      status: 'succeeded',
      paidAt,
      coveredThroughYear,
      coversYears,
      createdAt: local?.createdAt || paidAt,
      updatedAt: paidAt,
    }, { merge: true })

    // Update membership summary
    if (userId) {
      await adminDb.collection('memberships').doc(String(userId)).set({
        userId: String(userId),
        fullName: fullName || null,
        currentStatus: 'club',
        coveredThroughYear,
        lastPaymentId: `checkout_${reference}`,
        updatedAt: paidAt,
      }, { merge: true })
    }

    // Discord role automation
    const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
    const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
    const clubMemberRoleId = typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''

    if (clubMemberRoleId) {
      const guildId = process.env.DISCORD_GUILD_ID as string
      const botToken = process.env.DISCORD_BOT_TOKEN as string
      if (guildId && botToken && userId) {
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

    return NextResponse.json({ 
      reference, 
      sessionState, 
      paymentState: 'CAPTURED',
      status: 'succeeded' 
    }, { status: 200 })
  } catch (err: any) {
    console.error('Vipps Checkout confirm error:', err)
    return NextResponse.json({ error: err?.message || 'Confirm failed' }, { status: 500 })
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

