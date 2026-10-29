import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { listGuildChannels } from '@/app/api/admin/_lib/discord'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS, sharedConstants } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/intervalsAuth'
import { FIELD_SPECS, announcerDefaults, flattenSettings, mergeSettings, sanitizeSettings } from '@/packages/shared/announcerSettings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The bot reads this document (cached 5 minutes) and keeps its run state in bot_state/announcer.
const settingsRef = () => adminDb.collection(COLLECTIONS.systemSettings).doc('announcer')
const stateRef = () => adminDb.collection('bot_state').doc('announcer')
const DRAFTS = (COLLECTIONS as Record<string, string>).announcerDrafts || 'announcer_drafts'
const TEXT_CHANNEL = 0
const ANNOUNCEMENT_CHANNEL = 5

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const defaults = announcerDefaults(sharedConstants.discord.channels)
  const [settingsSnap, stateSnap, openSnap, channels] = await Promise.all([
    settingsRef().get(),
    stateRef().get(),
    adminDb.collection(DRAFTS).where('status', 'in', ['pending', 'queued']).get(),
    listGuildChannels().catch(() => []),
  ])
  const state = stateSnap.data() || {}
  return NextResponse.json({
    specs: FIELD_SPECS,
    defaults: flattenSettings(defaults),
    values: flattenSettings(mergeSettings(defaults, settingsSnap.data() || {})),
    paused: Boolean(state.paused),
    published: ((state.published || []) as Array<Record<string, unknown>>).slice(-10).reverse().map((row) => ({
      at: toIso(row.at),
      kind: row.kind,
      key: row.key,
      channelId: row.channelId,
    })),
    openDrafts: openSnap.docs.map((doc) => ({ id: doc.id, kind: doc.get('kind'), status: doc.get('status'), createdAt: toIso(doc.get('createdAt')) })),
    channels: (channels as Array<{ id: string; name: string; type: number; position?: number }>)
      .filter((c) => c.type === TEXT_CHANNEL || c.type === ANNOUNCEMENT_CHANNEL)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ id: String(c.id), name: c.name })),
  })
}

/** { values: { [path]: value } }: save the settings form. Only fields in FIELD_SPECS are written. */
export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const { patch, errors } = sanitizeSettings(body?.values || {})
  if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  const by = String((auth.token as { name?: unknown })?.name || '').trim() || null
  await settingsRef().set({ ...patch, settingsUpdated: { at: new Date(), by } }, { merge: true })
  return NextResponse.json({ ok: true })
}

/** { paused }: pause or resume bot posts and DM reminders, like /announcer_pause. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  if (typeof body?.paused !== 'boolean') return NextResponse.json({ error: 'paused (true|false) required' }, { status: 400 })
  await stateRef().set({ paused: body.paused }, { merge: true })
  return NextResponse.json({ ok: true, paused: body.paused })
}
