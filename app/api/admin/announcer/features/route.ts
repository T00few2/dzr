import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/intervalsAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The bot detects its spotlight features from its own commands and tools and publishes them to
// bot_state/announcer_features. Admins only choose which ones to leave out
// (system_settings/announcer.spotlightExcluded) and which commit-log features to skip
// (bot_state/announcer.shippedFeatures[].dismissed). There are no texts to keep up to date here.
const settingsRef = () => adminDb.collection(COLLECTIONS.systemSettings).doc('announcer')
const stateRef = () => adminDb.collection('bot_state').doc('announcer')
const catalogRef = () => adminDb.collection('bot_state').doc('announcer_features')

type Feature = { key: string; name: string; description: string; howToUse: string; usedLast30Days: number | null; internal: boolean }
type Shipped = { slug: string; title: string; pitch?: string; howTo?: string; at?: unknown; spotlightedAt?: unknown; dismissed?: boolean }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const [settingsSnap, stateSnap, catalogSnap] = await Promise.all([settingsRef().get(), stateRef().get(), catalogRef().get()])
  const excluded = new Set<string>(settingsSnap.data()?.spotlightExcluded || [])
  const perSignal: Record<string, unknown> = stateSnap.data()?.perSignal || {}
  const features = ((catalogSnap.data()?.features || []) as Feature[])
    .filter((feature) => !feature.internal)
    .map((feature) => ({
      key: feature.key,
      name: feature.name,
      description: feature.description,
      usedLast30Days: feature.usedLast30Days,
      excluded: excluded.has(feature.key),
      lastSpotlightedAt: toIso(perSignal[`featureSpotlight:${feature.key}`]) || null,
    }))
  const shipped = ((stateSnap.data()?.shippedFeatures || []) as Shipped[]).map((feature) => ({
    slug: feature.slug,
    title: feature.title,
    pitch: feature.pitch || '',
    at: toIso(feature.at),
    spotlightedAt: toIso(feature.spotlightedAt),
    dismissed: Boolean(feature.dismissed),
  }))
  return NextResponse.json({ features, detectedAt: toIso(catalogSnap.data()?.updatedAt) || null, shipped: shipped.reverse() })
}

/** { key, excluded }: keep a detected feature out of the spotlight, or let it back in. */
export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const key = typeof body?.key === 'string' ? body.key : ''
  if (!/^[a-z0-9_]{1,60}$/.test(key) || typeof body?.excluded !== 'boolean') {
    return NextResponse.json({ error: 'key and excluded (true|false) required' }, { status: 400 })
  }
  await settingsRef().set({
    spotlightExcluded: body.excluded ? FieldValue.arrayUnion(key) : FieldValue.arrayRemove(key),
  }, { merge: true })
  return NextResponse.json({ ok: true })
}

/** { slug, dismissed }: skip a feature found in the commit log, or put it back in the rotation. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const slug = String(body?.slug || '')
  if (!slug || typeof body?.dismissed !== 'boolean') return NextResponse.json({ error: 'slug and dismissed (true|false) required' }, { status: 400 })
  const found = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef())
    const list = (snap.data()?.shippedFeatures || []) as Shipped[]
    if (!list.some((feature) => feature.slug === slug)) return false
    tx.set(stateRef(), { shippedFeatures: list.map((feature) => (feature.slug === slug ? { ...feature, dismissed: body.dismissed } : feature)) }, { merge: true })
    return true
  })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
