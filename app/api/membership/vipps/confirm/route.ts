import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCapturePayment, vippsGetPayment, vippsGetPaymentEvents } from '@/app/api/membership/vippsClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = Boolean((token as any)?.isAdmin)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const callerUserId = String((token as any)?.discordId || (token as any)?.sub || '').trim()

    const { searchParams } = new URL(req.url)
    const reference = String(searchParams.get('reference') || '').trim()
    if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

    // Load local record early so we can capture even if Vipps GET doesn't include amount fields.
    const localSnap = await adminDb.collection('payments').doc(`vipps_${reference}`).get()
    const local = localSnap.exists ? (localSnap.data() || {}) as any : {}

    let payment: any = await vippsGetPayment(reference)
    const stateRaw0 = (payment as any)?.state
    let state = Array.isArray(stateRaw0) ? String(stateRaw0[0] || '').toUpperCase() : String(stateRaw0 || '').toUpperCase()
    const capturedAmount0 = Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) || 0
    if (capturedAmount0 > 0) state = 'CAPTURED'

    // For merchants using AUTH+CAPTURE flow, a "successful" wallet checkout can still leave the payment AUTHORIZED.
    // For a membership fee (digital service), capturing immediately is a common flow.
    // You can disable auto-capture by setting VIPPS_AUTO_CAPTURE=false.
    // Docs: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/operations/capture/
    const autoCaptureEnabled = String(process.env.VIPPS_AUTO_CAPTURE || 'true').toLowerCase() !== 'false'
    if (autoCaptureEnabled && state === 'AUTHORIZED') {
      // Some Vipps GET responses omit amount fields; fall back to our local stored amount.
      const amountValueFromApi = Number((payment as any)?.amount?.value ?? 0)
      const currencyFromApi = String((payment as any)?.amount?.currency || '').toUpperCase()
      const currency = (currencyFromApi || String(local?.currency || 'DKK')).toUpperCase()

      // Some Vipps GET responses include reserved/authorized amounts under aggregate fields.
      const aggregateAuthorizedValue =
        Number((payment as any)?.aggregate?.authorizedAmount?.value ?? 0) ||
        Number((payment as any)?.aggregate?.reservedAmount?.value ?? 0) ||
        0
      const aggregateCapturedValue =
        Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) ||
        Number((payment as any)?.aggregate?.captured?.value ?? 0) ||
        0
      const aggregateRemainingValue =
        aggregateAuthorizedValue > 0 ? Math.max(aggregateAuthorizedValue - aggregateCapturedValue, 0) : 0

      // Preferred: use the authorized amount from Vipps events (this avoids "capture amount too high" 6090).
      let authorizedValueFromEvents = 0
      let bestValueFromEvents = 0
      let eventsError: string | null = null
      try {
        const events = await vippsGetPaymentEvents(reference)
        const compactEvents = events.slice(-20).map((ev: any) => ({
          name: String(ev?.name || ''),
          value: Number(ev?.amount?.value ?? 0) || null,
          currency: String(ev?.amount?.currency || '') || null,
          timestamp: String(ev?.timestamp || ev?.timeStamp || '') || null,
        }))

        // Persist events for debugging (limited to last 20 to avoid huge docs)
        await adminDb.collection('payments').doc(`vipps_${reference}`).set({
          vipps: {
            lastEventsFetchedAt: new Date().toISOString(),
            lastEvents: compactEvents,
          },
          updatedAt: new Date().toISOString(),
        }, { merge: true })

        // Prefer an AUTHORIZED/RESERVED event amount, otherwise fall back to max amount seen in events.
        for (let i = events.length - 1; i >= 0; i--) {
          const ev = events[i] as any
          const name = String(ev?.name || '').toUpperCase()
          const v = Number(ev?.amount?.value ?? 0)
          if (v > bestValueFromEvents) bestValueFromEvents = v
          if (name === 'AUTHORIZED' || name === 'RESERVED') {
            if (v > 0) {
              authorizedValueFromEvents = v
              break
            }
          }
        }
      } catch (err: any) {
        eventsError = String(err?.message || err)
      }

      const amountDkkLocal = Number(local?.amountDkk ?? 0)
      const amountValueLocal = amountDkkLocal > 0 ? Math.round(amountDkkLocal * 100) : 0

      const candidates = Array.from(new Set([
        authorizedValueFromEvents,
        bestValueFromEvents,
        aggregateRemainingValue,
        aggregateAuthorizedValue,
        amountValueFromApi,
        amountValueLocal,
      ].filter(v => typeof v === 'number' && v > 0)))
        .sort((a, b) => a - b)

      if (candidates.length > 0) {
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
            // If error is NOT "capture amount too high", don't keep guessing.
            const msg = String(err?.message || '').toLowerCase()
            if (!msg.includes('capture amount too high') && !msg.includes('6090')) {
              break
            }
          }
        }

        await adminDb.collection('payments').doc(`vipps_${reference}`).set({
          vipps: {
            lastCaptureAttemptAt: new Date().toISOString(),
            lastCaptureCandidates: candidates,
            lastCaptureAttempts: attempts,
            lastEventsError: eventsError,
            lastPaymentSnapshot: {
              state: String((payment as any)?.state || ''),
              amountValue: Number((payment as any)?.amount?.value ?? 0) || null,
              amountCurrency: String((payment as any)?.amount?.currency || '') || null,
              aggregateAuthorizedValue: aggregateAuthorizedValue || null,
              aggregateCapturedValue: aggregateCapturedValue || null,
              aggregateRemainingValue: aggregateRemainingValue || null,
            },
          },
          updatedAt: new Date().toISOString(),
        }, { merge: true })

        // Re-check state after capture attempts
        if (captured) {
          payment = await vippsGetPayment(reference)
          state = String((payment as any)?.state || '').toUpperCase()
        }
      } else {
        await adminDb.collection('payments').doc(`vipps_${reference}`).set({
          vipps: {
            lastCaptureAttemptAt: new Date().toISOString(),
            lastCaptureError: 'Could not determine any amount candidates for capture',
            lastEventsError: eventsError,
          },
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }
    }

    // Membership should only be activated after the payment is CAPTURED (funds moved), not just AUTHORIZED (reserved).
    // See: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/operations/capture/
    const capturedAmount1 = Number((payment as any)?.aggregate?.capturedAmount?.value ?? 0) || 0
    const isPaidForMembership = state === 'CAPTURED' || capturedAmount1 > 0
    const isTerminalFail = state === 'CANCELLED' || state === 'EXPIRED' || state === 'TERMINATED'

    // Persist state for observability
    await adminDb.collection('payments').doc(`vipps_${reference}`).set({
      paymentProvider: 'vipps',
      vipps: {
        reference,
        pspReference: String((payment as any)?.pspReference || ''),
        state: state || null,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    if (!isPaidForMembership) {
      return NextResponse.json({
        reference,
        state: state || null,
        status: isTerminalFail ? 'failed' : (state === 'AUTHORIZED' ? 'authorized' : 'pending'),
      }, { status: 200 })
    }

    const metadata = ((payment as any)?.metadata || {}) as Record<string, string>
    const localUserId = String(local?.userId || '').trim()
    const metaUserId = String(metadata?.userId || '').trim()
    const userId = String(localUserId || metaUserId || callerUserId || '').trim()

    // Safety: ensure the payment is tied to the currently logged-in user (unless local/meta is missing).
    if (callerUserId && localUserId && callerUserId !== localUserId) {
      return NextResponse.json({ error: 'Payment does not belong to current user' }, { status: 403 })
    }
    const fullName = String(local?.fullName || metadata?.fullName || '').trim()
    const userEmail = String(local?.userEmail || metadata?.userEmail || '').trim()

    const amountValue = Number((payment as any)?.amount?.value ?? 0)
    const currency = String((payment as any)?.amount?.currency || local?.currency || 'DKK').toUpperCase()
    const amount = amountValue ? amountValue / 100 : Number(local?.amountDkk || 0)

    // Coverage years from local record first, then metadata
    let coversYears: number[] | null = Array.isArray(local?.coversYears) ? local.coversYears : null
    if (!coversYears || coversYears.length === 0) {
      const metaYears = String(metadata?.coversYears || '').trim()
      if (metaYears) {
        coversYears = metaYears.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n))
      }
    }
    if (!coversYears || coversYears.length === 0) {
      coversYears = [new Date().getUTCFullYear()]
    }
    const coveredThroughYear = Math.max(...coversYears)

    const paidAt = new Date().toISOString()

    // Store payment record (idempotent merge)
    await adminDb.collection('payments').doc(`vipps_${reference}`).set({
      userId: userId || 'unknown',
      userEmail,
      fullName,
      amountDkk: amount,
      currency,
      paymentProvider: 'vipps',
      vipps: {
        reference,
        pspReference: String((payment as any)?.pspReference || ''),
        state: state || 'CAPTURED',
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
        lastPaymentId: `vipps_${reference}`,
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

    return NextResponse.json({ reference, state: state || null, status: 'succeeded' }, { status: 200 })
  } catch (err: any) {
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


