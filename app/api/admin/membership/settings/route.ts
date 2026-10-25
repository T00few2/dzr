import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { normalizePaymentOptions } from '@/app/lib/membershipPaymentOptions'
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
    paymentOptions: normalizePaymentOptions(membership.paymentOptions),
  })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const data = await req.json().catch(() => ({}))
  const minAmountDkk = Number(data.minAmountDkk ?? 10)
  const maxAmountDkk = Number(data.maxAmountDkk ?? 100)
  if (!(minAmountDkk > 0) || !(maxAmountDkk > 0) || minAmountDkk > maxAmountDkk) {
    return NextResponse.json({ error: 'Invalid amount range' }, { status: 400 })
  }

  const ref = adminDb.collection(COLLECTIONS.systemSettings).doc('global')
  const existingSnap = await ref.get()
  const existing = (existingSnap.exists ? existingSnap.data()?.membership : {}) || {}
  const incomingRole = String(data.clubMemberRoleId ?? '').trim()
  const existingRole = String(existing.clubMemberRoleId || '').trim()
  const clubMemberRoleId = incomingRole || existingRole
  const patch: Record<string, unknown> = {
    'membership.minAmountDkk': minAmountDkk,
    'membership.maxAmountDkk': maxAmountDkk,
    'membership.clubMemberRoleId': clubMemberRoleId,
    'membership.updatedAt': new Date().toISOString(),
  }
  // Missing paymentOptions means "leave them alone". The old admin form omitted
  // the field and the default [] wiped every period on save.
  if (Array.isArray(data.paymentOptions)) {
    patch['membership.paymentOptions'] = normalizePaymentOptions(data.paymentOptions)
  }
  await ref.update(patch)
  return NextResponse.json({ success: true, clubMemberRoleId })
}
