import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/intervalsAuth'

/**
 * GET/PUT handlers for a set of bot texts admins can change (DM reminders, onboarding DMs).
 *
 * The texts live in system_settings/<docId> under <prefix>.texts.<key>, with who changed them
 * under <prefix>.textsUpdated.<key>. Saving an empty text or the default itself deletes the
 * stored text, so the bot goes back to the default.
 */
export function textTemplateRoutes(opts: {
  docId: string
  prefix?: string
  maxChars: number
  defaults: () => Record<string, string>
  specs: Record<string, { label: string; placeholders?: Record<string, string> }>
  enabled?: (data: Record<string, any>) => boolean
}) {
  const ref = () => adminDb.collection(COLLECTIONS.systemSettings).doc(opts.docId)
  const nest = (value: Record<string, unknown>) => (opts.prefix ? { [opts.prefix]: value } : value)
  const section = (data: Record<string, any>) => (opts.prefix ? data[opts.prefix] : data) || {}

  async function GET(req: Request) {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const data = (await ref().get()).data() || {}
    const texts: Record<string, unknown> = section(data).texts || {}
    const updated: Record<string, { at?: unknown; by?: string }> = section(data).textsUpdated || {}
    const defaults = opts.defaults()
    const items = Object.entries(opts.specs).map(([key, spec]) => {
      const custom = typeof texts[key] === 'string' ? String(texts[key]).trim() : ''
      return {
        key,
        label: spec.label,
        placeholders: spec.placeholders || {},
        defaultText: defaults[key],
        text: custom || defaults[key],
        isCustom: Boolean(custom),
        updatedAt: toIso(updated[key]?.at) || null,
        updatedBy: updated[key]?.by || null,
      }
    })
    return NextResponse.json({ items, maxChars: opts.maxChars, enabled: opts.enabled ? opts.enabled(data) : true })
  }

  /** { key, text } */
  async function PUT(req: Request) {
    const auth = await requireAdmin(req)
    if (auth.error) return auth.error
    const body = await req.json().catch(() => ({}))
    const key = body?.key
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(opts.specs, key)) {
      return NextResponse.json({ error: 'Unknown text' }, { status: 400 })
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (text.length > opts.maxChars) {
      return NextResponse.json({ error: `The text is longer than ${opts.maxChars} characters` }, { status: 400 })
    }
    const isDefault = !text || text === opts.defaults()[key]
    const by = String((auth.token as { name?: unknown })?.name || '').trim() || null
    await ref().set(nest({
      texts: { [key]: isDefault ? FieldValue.delete() : text },
      textsUpdated: { [key]: { at: new Date(), by } },
    }), { merge: true })
    return NextResponse.json({ ok: true, isCustom: !isDefault })
  }

  return { GET, PUT }
}
