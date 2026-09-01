import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const snap = await adminDb.collection(COLLECTIONS.payments).limit(100000).get()
  const totals: Record<number, { totalAmountDkk: number; count: number }> = {}
  snap.docs.forEach((d) => {
    const p: any = d.data()
    if (String(p.status || '').toLowerCase() !== 'succeeded') return
    const raw = p.paidAt || p.createdAt
    const dt = raw ? new Date(typeof raw?.toDate === 'function' ? raw.toDate() : raw) : null
    if (!dt || Number.isNaN(dt.getTime())) return
    const amt = Number(p.amountDkk)
    if (!Number.isFinite(amt)) return
    const year = dt.getUTCFullYear()
    if (!totals[year]) totals[year] = { totalAmountDkk: 0, count: 0 }
    totals[year].totalAmountDkk += amt
    totals[year].count += 1
  })
  const out = Object.keys(totals).map(Number).sort((a, b) => b - a).map((year) => ({ year, ...totals[year] }))
  return NextResponse.json({ totals: out })
}
