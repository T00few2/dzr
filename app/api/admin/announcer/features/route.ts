import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS, SITE_ORIGIN, sharedConstants } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/intervalsAuth'
import { resolveFeatures, sanitizeFeature } from '@/packages/shared/announcerFeatures'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Feature changes live in system_settings/announcer as features.<key>; features found in the
// commit log live in the bot's run state, bot_state/announcer.shippedFeatures.
const settingsRef = () => adminDb.collection(COLLECTIONS.systemSettings).doc('announcer')
const stateRef = () => adminDb.collection('bot_state').doc('announcer')
const LINKS = { siteOrigin: SITE_ORIGIN, zwiftIdChannelId: sharedConstants.discord.channels.zwiftId }

type Shipped = { slug: string; title: string; pitch?: string; howTo?: string; at?: unknown; spotlightedAt?: unknown; dismissed?: boolean }

function keyFor(title: string, taken: Set<string>) {
  const base = `custom_${title.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'feature'}`
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
  return key
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const [settingsSnap, stateSnap] = await Promise.all([settingsRef().get(), stateRef().get()])
  const shipped = ((stateSnap.data()?.shippedFeatures || []) as Shipped[]).map((feature) => ({
    slug: feature.slug,
    title: feature.title,
    pitch: feature.pitch || '',
    howTo: feature.howTo || '',
    at: toIso(feature.at),
    spotlightedAt: toIso(feature.spotlightedAt),
    dismissed: Boolean(feature.dismissed),
  }))
  return NextResponse.json({ features: resolveFeatures(settingsSnap.data()?.features, LINKS), shipped: shipped.reverse() })
}

/** { key?, feature }: save a feature. Without a key it is a new, admin-added feature. */
export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const feature = sanitizeFeature(body?.feature)
  if (!feature) return NextResponse.json({ error: 'A feature needs a title' }, { status: 400 })
  const known = resolveFeatures((await settingsRef().get()).data()?.features, LINKS)
  const requested = typeof body?.key === 'string' ? body.key : ''
  if (requested && !known.some((f) => f.key === requested)) return NextResponse.json({ error: 'Unknown feature' }, { status: 404 })
  const key = requested || keyFor(feature.title, new Set(known.map((f) => f.key)))
  await settingsRef().set({ features: { [key]: feature } }, { merge: true })
  return NextResponse.json({ ok: true, key })
}

/** ?key=: reset a default feature to its original text, or delete an admin-added one. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const key = new URL(req.url).searchParams.get('key') || ''
  if (!/^[a-z0-9_]{1,60}$/.test(key)) return NextResponse.json({ error: 'key required' }, { status: 400 })
  await settingsRef().set({ features: { [key]: FieldValue.delete() } }, { merge: true })
  return NextResponse.json({ ok: true })
}

/** { slug, title?, pitch?, howTo?, dismissed? }: change or skip a feature found in the commit log. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const slug = String(body?.slug || '')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
  const found = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef())
    const list = (snap.data()?.shippedFeatures || []) as Shipped[]
    if (!list.some((feature) => feature.slug === slug)) return false
    const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
    const next = list.map((feature) => {
      if (feature.slug !== slug) return feature
      const changed = { ...feature }
      if (body.title !== undefined && text(body.title, 80)) changed.title = text(body.title, 80)
      if (body.pitch !== undefined) changed.pitch = text(body.pitch, 500)
      if (body.howTo !== undefined) changed.howTo = text(body.howTo, 500)
      if (typeof body.dismissed === 'boolean') changed.dismissed = body.dismissed
      return changed
    })
    tx.set(stateRef(), { shippedFeatures: next }, { merge: true })
    return true
  })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
