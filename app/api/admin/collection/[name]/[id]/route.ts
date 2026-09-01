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

export async function PUT(req: Request, { params }: { params: { name: string; id: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  if (!ALLOWED.has(params.name)) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const data = coerceAdminFields({ ...body })
  delete data.id
  data.updatedAt = new Date().toISOString()
  await adminDb.collection(params.name).doc(params.id).set(data, { merge: true })
  return NextResponse.json({ id: params.id, ...data })
}

export async function DELETE(req: Request, { params }: { params: { name: string; id: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  if (!ALLOWED.has(params.name)) return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  await adminDb.collection(params.name).doc(params.id).delete()
  return NextResponse.json({ ok: true })
}
