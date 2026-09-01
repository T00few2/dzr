import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const snap = await adminDb.collection(COLLECTIONS.payments).limit(100000).get()
  const usersSnap = await adminDb.collection(COLLECTIONS.users).limit(100000).get()
  const discordToZwift: Record<string, string> = {}
  const discordToEmail: Record<string, string> = {}
  usersSnap.docs.forEach((d) => {
    const u = d.data() || {}
    const did = String(u.discordId || d.id).trim()
    if (did && u.zwiftId) discordToZwift[did] = String(u.zwiftId)
    if (did && u.email) discordToEmail[did] = String(u.email)
  })
  const header = [
    'createdAt','paidAt','userId','discordId','zwiftId','fullName','userEmail','amountDkk','currency','status',
    'coveredThroughYear','coversYears','provider','reference',
  ]
  const rows = [header.join(',')]
  snap.docs.forEach((d) => {
    const p: any = { id: d.id, ...d.data() }
    const did = String(p.discordId || p.userId || '').trim()
    const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`
    rows.push([
      p.createdAt, p.paidAt, p.userId, did, discordToZwift[did] || '', p.fullName,
      p.userEmail || discordToEmail[did] || '', p.amountDkk, p.currency, p.status,
      p.coveredThroughYear, (p.coversYears || []).join('|'), p.paymentProvider,
      p.checkout?.reference || p.vipps?.reference || '',
    ].map(esc).join(','))
  })
  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="payments.csv"',
    },
  })
}
