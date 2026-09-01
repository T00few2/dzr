import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

const ALLOWED = new Set(Object.values(COLLECTIONS))

function coerceAdminFields(data: Record<string, any>) {
  if (typeof data.tags === 'string') {
    data.tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
  }
  if (typeof data.active === 'string') {
    const v = data.active.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(v)) data.active = true
    else if (['false', '0', 'no', 'off'].includes(v)) data.active = false
  }
  return data
}

export async function GET(req: Request, { params }: { params: { name: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const name = params.name
  if (!ALLOWED.has(name)) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  const snap = await adminDb.collection(name).limit(500).get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ docs })
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const name = params.name
  if (!ALLOWED.has(name)) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' && body.id.trim() ? String(body.id).trim() : undefined
  const data = coerceAdminFields({ ...body })
  delete data.id
  data.updatedAt = new Date().toISOString()
  if (id) {
    await adminDb.collection(name).doc(id).set(data, { merge: true })
    return NextResponse.json({ id, ...data })
  }
  const ref = await adminDb.collection(name).add(data)
  return NextResponse.json({ id: ref.id, ...data })
}
