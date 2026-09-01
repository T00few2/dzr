import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

function parseDate(x: any) {
  for (const field of ['createdAt', 'paidAt', 'updatedAt']) {
    const val = x?.[field]
    if (!val) continue
    const d = new Date(typeof val?.toDate === 'function' ? val.toDate() : val)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(0)
}

async function userLookups() {
  const users = await adminDb.collection(COLLECTIONS.users).limit(100000).get()
  const discordToZwift: Record<string, string> = {}
  const discordToEmail: Record<string, string> = {}
  users.docs.forEach((d) => {
    const u = d.data() || {}
    const did = String(u.discordId || d.id).trim()
    const zid = String(u.zwiftId || '').trim()
    const em = String(u.email || '').trim()
    if (did && zid) discordToZwift[did] = zid
    if (did && em) discordToEmail[did] = em
  })
  return { discordToZwift, discordToEmail }
}

function enrich(p: any, lookups: { discordToZwift: Record<string, string>; discordToEmail: Record<string, string> }) {
  const uid = String(p.userId || '').trim()
  const did = String(p.discordId || uid).trim()
  const provider = String(p.paymentProvider || '').trim().toLowerCase() || 'unknown'
  const vipps = p.vipps || {}
  const checkout = p.checkout || {}
  let providerState = String(p.status || '').toUpperCase()
  let providerRef = String(p.id || '')
  if (provider === 'vipps-checkout') {
    providerState = String(checkout.state || p.status || '').toUpperCase()
    providerRef = String(checkout.reference || p.id || '')
  } else if (provider === 'vipps') {
    providerState = String(vipps.state || p.status || '').toUpperCase()
    providerRef = String(vipps.reference || p.id || '')
  }
  return {
    ...p,
    discordId: did,
    zwiftId: lookups.discordToZwift[did] || '',
    userEmail: String(p.userEmail || '').trim() || lookups.discordToEmail[did] || '',
    provider,
    providerState,
    providerRef,
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const url = new URL(req.url)
  const statusFilter = (url.searchParams.get('status') || '').trim().toLowerCase()
  const limit = Math.min(Number(url.searchParams.get('limit') || 200), 2000)
  const snap = await adminDb.collection(COLLECTIONS.payments).limit(limit).get()
  const lookups = await userLookups()
  let payments = snap.docs.map((d) => enrich({ id: d.id, ...d.data() }, lookups))
  if (statusFilter) payments = payments.filter((p) => String(p.status || '').toLowerCase() === statusFilter)
  payments.sort((a, b) => parseDate(b).getTime() - parseDate(a).getTime())
  return NextResponse.json({ payments })
}
