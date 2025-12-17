import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (token as any)?.discordId || (token as any)?.sub || null
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load cached membership doc (for name fallback)
    const membershipSnap = await adminDb.collection('memberships').doc(String(userId)).get()
    const cached = membershipSnap.exists ? (membershipSnap.data() || {}) : {}

    // Compute current coverage based on successful payments
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('userId', '==', String(userId))
      .where('status', '==', 'succeeded')
      .get()

    let maxCoveredThrough: number | null = null
    let lastPaymentId: string | null = null
    let latestPaidAt: string | null = null
    const coveredYearsSet = new Set<number>()
    paymentsSnap.forEach((p) => {
      const d = p.data() || {}
      const covered = typeof d.coveredThroughYear === 'number' ? d.coveredThroughYear : null
      const paidAt = typeof d.paidAt === 'string' ? d.paidAt : null
      const coversYears: number[] = Array.isArray(d.coversYears) ? d.coversYears : []
      for (const y of coversYears) {
        if (typeof y === 'number') coveredYearsSet.add(y)
      }
      if (covered != null && (maxCoveredThrough == null || covered > maxCoveredThrough)) {
        maxCoveredThrough = covered
      }
      if (paidAt && (!latestPaidAt || paidAt > latestPaidAt)) {
        latestPaidAt = paidAt
        lastPaymentId = d?.vipps?.reference || p.id
      }
    })

    const currentYear = new Date().getUTCFullYear()
    const computedStatus = maxCoveredThrough != null && maxCoveredThrough >= currentYear ? 'club' : 'community'

    // Optionally persist the computed values back to the membership doc to keep it in sync
    try {
      await adminDb.collection('memberships').doc(String(userId)).set({
        userId: String(userId),
        currentStatus: computedStatus,
        coveredThroughYear: maxCoveredThrough ?? null,
        lastPaymentId: lastPaymentId ?? null,
        fullName: cached?.fullName ?? null,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    } catch {}

    return NextResponse.json({
      userId,
      currentStatus: computedStatus,
      coveredThroughYear: maxCoveredThrough ?? null,
      lastPaymentId: lastPaymentId ?? null,
      fullName: cached?.fullName ?? null,
      coveredYears: Array.from(coveredYearsSet).sort()
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load summary' }, { status: 500 })
  }
}


