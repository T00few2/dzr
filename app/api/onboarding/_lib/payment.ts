import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { vippsCapturePayment, vippsGetCheckoutSession } from '@/app/api/membership/vippsClient'
import { syncClubMemberRole } from '@/app/utils/discordRoleSync'
import { updateOnboardingSession } from '@/app/api/onboarding/_lib/session'

type ProcessPaymentResult =
  | { status: 'succeeded'; reference: string }
  | { status: 'pending'; reference: string }
  | { status: 'failed'; reference: string }
  | { status: 'forbidden'; reference: string }
  | { status: 'not_found'; reference: string }

export async function processOnboardingPayment(reference: string, expectedSessionId?: string): Promise<ProcessPaymentResult> {
  const cleanReference = String(reference || '').trim()
  if (!cleanReference) return { status: 'not_found', reference: cleanReference }

  const docRef = adminDb.collection('payments').doc(`checkout_${cleanReference}`)
  const localSnap = await docRef.get()
  if (!localSnap.exists) return { status: 'not_found', reference: cleanReference }
  const local = (localSnap.data() || {}) as any
  const onboardingSessionId = String(local?.onboardingSessionId || '').trim()
  if (!onboardingSessionId) return { status: 'forbidden', reference: cleanReference }
  if (expectedSessionId && onboardingSessionId !== expectedSessionId) {
    return { status: 'forbidden', reference: cleanReference }
  }

  let session: any = null
  try {
    session = await vippsGetCheckoutSession(cleanReference)
  } catch {
    // Keep processing from local record if Vipps fetch fails.
  }

  const sessionState = String(session?.sessionState || '').trim()
  let paymentState = String(session?.paymentDetails?.state || '').toUpperCase()
  let capturedAmount = Number(session?.paymentDetails?.aggregate?.capturedAmount?.value ?? 0)
  const authorizedAmount = Number(session?.paymentDetails?.aggregate?.authorizedAmount?.value ?? 0)
  const amountValue = Number(session?.paymentDetails?.amount?.value ?? 0)
  const currency = String(session?.paymentDetails?.amount?.currency || local?.currency || 'DKK').toUpperCase()

  if (paymentState === 'AUTHORIZED' && capturedAmount === 0 && (authorizedAmount > 0 || amountValue > 0)) {
    const captureAmount = authorizedAmount || amountValue
    try {
      await vippsCapturePayment(cleanReference, captureAmount, currency)
      paymentState = 'CAPTURED'
      capturedAmount = captureAmount
    } catch {
      // Leave as pending.
    }
  }

  const isCaptured = paymentState === 'CAPTURED' || capturedAmount > 0
  const isSuccessful = sessionState === 'PaymentSuccessful' || isCaptured
  const isTerminalFail = sessionState === 'SessionExpired' || sessionState === 'PaymentTerminated' || paymentState === 'TERMINATED'

  await docRef.set({
    checkout: {
      reference: cleanReference,
      sessionState: sessionState || null,
      paymentState: paymentState || null,
      capturedAmount: capturedAmount || null,
      lastOnboardingConfirmAt: new Date().toISOString(),
      lastSessionInfo: session || null,
    },
    updatedAt: new Date().toISOString(),
  }, { merge: true })

  if (!isSuccessful) {
    return { status: isTerminalFail ? 'failed' : 'pending', reference: cleanReference }
  }

  const userId = String(local?.userId || local?.discordId || '').trim()
  const billingDetails = session?.billingDetails || {}
  const fullName = String(local?.fullName || `${billingDetails.firstName || ''} ${billingDetails.lastName || ''}`.trim() || '').trim()
  const userEmail = String(local?.userEmail || billingDetails?.email || '').trim()
  const amount = amountValue ? amountValue / 100 : Number(local?.amountDkk || 0)
  const coversYears: number[] = Array.isArray(local?.coversYears) ? local.coversYears : [new Date().getUTCFullYear()]
  const coveredThroughYear = typeof local?.coveredThroughYear === 'number' ? local.coveredThroughYear : Math.max(...coversYears)
  const paidAt = new Date().toISOString()

  await docRef.set({
    userId: userId || 'unknown',
    userEmail,
    fullName,
    amountDkk: amount,
    currency,
    status: 'succeeded',
    paidAt,
    coveredThroughYear,
    coversYears,
    updatedAt: paidAt,
  }, { merge: true })

  if (userId) {
    await adminDb.collection('memberships').doc(userId).set({
      userId,
      fullName: fullName || null,
      currentStatus: 'club',
      coveredThroughYear,
      lastPaymentId: `checkout_${cleanReference}`,
      updatedAt: paidAt,
    }, { merge: true })

    const roleSync = await syncClubMemberRole({
      userId,
      coveredThroughYear,
      source: 'onboarding-payment',
    })
    await docRef.set({ roleSync }, { merge: true })
  }

  const onboardingSnap = await adminDb.collection('onboarding_sessions').doc(onboardingSessionId).get()
  const onboardingData = (onboardingSnap.exists ? onboardingSnap.data() : {}) as any

  await updateOnboardingSession(onboardingSessionId, {
    steps: {
      discordLinked: Boolean(onboardingData?.steps?.discordLinked),
      paymentSucceeded: true,
      zwiftLinked: Boolean(onboardingData?.steps?.zwiftLinked),
    },
    paymentSucceededAt: paidAt,
    paymentReference: cleanReference,
  })

  return { status: 'succeeded', reference: cleanReference }
}
