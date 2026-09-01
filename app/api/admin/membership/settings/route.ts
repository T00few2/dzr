import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const doc = await adminDb.collection(COLLECTIONS.systemSettings).doc('global').get()
  const membership = (doc.exists ? doc.data()?.membership : {}) || {}
  return NextResponse.json({
    minAmountDkk: Number(membership.minAmountDkk ?? 10),
    maxAmountDkk: Number(membership.maxAmountDkk ?? 100),
    clubMemberRoleId: String(membership.clubMemberRoleId || ''),
    paymentOptions: Array.isArray(membership.paymentOptions) ? membership.paymentOptions : [],
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const data = await req.json().catch(() => ({}))
  const minAmountDkk = Number(data.minAmountDkk ?? 10)
  const maxAmountDkk = Number(data.maxAmountDkk ?? 100)
  const clubMemberRoleId = String(data.clubMemberRoleId || '')
  const paymentOptions = Array.isArray(data.paymentOptions) ? data.paymentOptions : []
  if (!(minAmountDkk > 0) || !(maxAmountDkk > 0) || minAmountDkk > maxAmountDkk) {
    return NextResponse.json({ error: 'Invalid amount range' }, { status: 400 })
  }
  await adminDb.collection(COLLECTIONS.systemSettings).doc('global').set({
    membership: {
      minAmountDkk,
      maxAmountDkk,
      clubMemberRoleId,
      paymentOptions,
      updatedAt: new Date().toISOString(),
    },
  }, { merge: true })
  return NextResponse.json({ success: true })
}
