import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS, SITE_ORIGIN, sharedConstants } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/intervalsAuth'
import {
  MAX_REMINDER_CHARS,
  REMINDER_STEP_LABELS,
  defaultReminderTexts,
  type ReminderStep,
} from '@/packages/shared/reminderTexts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The bot reads its announcer settings, including these texts, from this document (cached 5 minutes).
const settingsRef = () => adminDb.collection(COLLECTIONS.systemSettings).doc('announcer')

const LINKS = { siteOrigin: SITE_ORIGIN, zwiftIdChannelId: sharedConstants.discord.channels.zwiftId }

function isStep(value: unknown): value is ReminderStep {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REMINDER_STEP_LABELS, value)
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const data = (await settingsRef().get()).data() || {}
  const texts: Record<string, unknown> = data.dmReminders?.texts || {}
  const updated: Record<string, { at?: unknown; by?: string }> = data.dmReminders?.textsUpdated || {}
  const defaults = defaultReminderTexts(LINKS)
  const steps = (Object.keys(REMINDER_STEP_LABELS) as ReminderStep[]).map((step) => {
    const custom = typeof texts[step] === 'string' ? String(texts[step]).trim() : ''
    return {
      step,
      label: REMINDER_STEP_LABELS[step],
      defaultText: defaults[step],
      text: custom || defaults[step],
      isCustom: Boolean(custom),
      updatedAt: toIso(updated[step]?.at) || null,
      updatedBy: updated[step]?.by || null,
    }
  })
  return NextResponse.json({ steps, maxChars: MAX_REMINDER_CHARS, enabled: data.dmReminders?.enabled !== false })
}

/** { step, text }: save a replacement text. An empty text, or the default itself, goes back to the default. */
export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const step = body?.step
  if (!isStep(step)) return NextResponse.json({ error: 'Unknown reminder step' }, { status: 400 })
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (text.length > MAX_REMINDER_CHARS) {
    return NextResponse.json({ error: `The text is longer than ${MAX_REMINDER_CHARS} characters` }, { status: 400 })
  }
  const isDefault = !text || text === defaultReminderTexts(LINKS)[step]
  const by = String((auth.token as { name?: unknown })?.name || '').trim() || null
  await settingsRef().set({
    dmReminders: {
      texts: { [step]: isDefault ? FieldValue.delete() : text },
      textsUpdated: { [step]: { at: new Date(), by } },
    },
  }, { merge: true })
  return NextResponse.json({ ok: true, isCustom: !isDefault })
}
