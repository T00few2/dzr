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

    const doc = await adminDb.collection('memberships').doc(String(userId)).get()
    if (!doc.exists) {
      return NextResponse.json({
        userId,
        currentStatus: 'community',
        coveredThroughYear: null,
        lastPaymentId: null,
        fullName: null
      }, { status: 200 })
    }
    const data = doc.data() || {}
    return NextResponse.json({
      userId,
      currentStatus: data.currentStatus || 'community',
      coveredThroughYear: data.coveredThroughYear ?? null,
      lastPaymentId: data.lastPaymentId ?? null,
      fullName: data.fullName ?? null
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load summary' }, { status: 500 })
  }
}


