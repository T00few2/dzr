import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole, INTERVALS_CONNECTIONS_COLLECTION, toIso } from '@/app/lib/intervalsAuth'
import { hasStoredAccessToken } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
    const discordId = String((session as any)?.discordId || '').trim()
    if (!discordId) {
      return NextResponse.json({ connected: false, eligible: false })
    }

    const eligible = await hasClubMemberRole(discordId)
    const snap = await adminDb.collection(INTERVALS_CONNECTIONS_COLLECTION).doc(discordId).get()
    if (!snap.exists) {
      return NextResponse.json({ connected: false, eligible })
    }

    const data = snap.data() || {}
    if (!hasStoredAccessToken(data)) {
      return NextResponse.json({ connected: false, eligible })
    }
    const athleteName = String(data.athleteName || '').trim()
      || [data.athleteFirstname, data.athleteLastname].map((part) => String(part || '').trim()).filter(Boolean).join(' ')
      || null

    return NextResponse.json({
      connected: true,
      eligible,
      athleteId: data.athleteId ?? null,
      athleteName,
      connectedAt: toIso(data.connectedAt),
    })
  } catch (err: any) {
    console.error('intervals status error:', err)
    return NextResponse.json({ error: err?.message || 'Status lookup failed' }, { status: 500 })
  }
}
