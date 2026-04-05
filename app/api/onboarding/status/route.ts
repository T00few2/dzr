import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { getOnboardingSessionFromRequest } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const onboarding = await getOnboardingSessionFromRequest(req)
    if (!onboarding) return NextResponse.json({ error: 'Missing onboarding session' }, { status: 401 })

    const discordId = String(onboarding.session.discordId || '').trim()
    if (!discordId) {
      return NextResponse.json({
        membershipAlreadyPaid: false,
        coveredThroughYear: null,
        zwiftId: null,
      }, { status: 200 })
    }

    const [membershipSnap, userSnap] = await Promise.all([
      adminDb.collection('memberships').doc(discordId).get(),
      adminDb.collection('users').doc(discordId).get(),
    ])

    const membership = membershipSnap.exists ? (membershipSnap.data() || {}) as any : {}
    const user = userSnap.exists ? (userSnap.data() || {}) as any : {}
    const coveredThroughYear = typeof membership?.coveredThroughYear === 'number' ? membership.coveredThroughYear : null
    const membershipAlreadyPaid =
      String(membership?.currentStatus || '') === 'club' &&
      typeof coveredThroughYear === 'number' &&
      coveredThroughYear >= new Date().getUTCFullYear()

    const zwiftId = user?.zwiftId != null ? String(user.zwiftId) : null

    return NextResponse.json({
      membershipAlreadyPaid,
      coveredThroughYear,
      zwiftId,
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load onboarding status' }, { status: 500 })
  }
}
