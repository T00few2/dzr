import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { sendDm } from '@/app/api/admin/_lib/discord'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

// Shared with the bot's onboarding DMs and DM reminders (onboarding_dms.lastBotDmAt), so a member
// never gets an admin DM right on top of one from the bot.
const RECENT_DM_MS = 3 * 24 * 60 * 60 * 1000

function toMs(value: unknown): number {
  if (!value) return 0
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis()
  const ms = new Date(value as string).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const members = Array.isArray(body.members) ? body.members : []
  const messageTemplate = String(body.messageTemplate || '')
  if (!members.length) return NextResponse.json({ error: 'No members provided' }, { status: 400 })
  if (!messageTemplate.trim()) return NextResponse.json({ error: 'Message template is empty' }, { status: 400 })

  let sent = 0
  let skipped = 0
  let recent = 0
  for (const item of members) {
    const discordId = String(item?.discord_id || '').trim()
    const username = String(item?.username || '')
    if (!discordId) { skipped += 1; continue }
    const dmRef = adminDb.collection('onboarding_dms').doc(discordId)
    const dmDoc = (await dmRef.get()).data() || {}
    if (Date.now() - toMs(dmDoc.lastBotDmAt) < RECENT_DM_MS) { recent += 1; continue }
    const msg = messageTemplate.replaceAll('{{username}}', username)
    const ok = await sendDm(discordId, msg)
    if (!ok) { skipped += 1; continue }
    sent += 1
    await dmRef.set({ lastBotDmAt: new Date() }, { merge: true })
    await new Promise((r) => setTimeout(r, 1100))
    const existing = await adminDb.collection('discord_zwift_reminders').doc(discordId).get()
    const prev = existing.data() || {}
    await adminDb.collection('discord_zwift_reminders').doc(discordId).set({
      discordID: discordId,
      lastReminderAt: new Date().toISOString(),
      reminderCount: Number(prev.reminderCount || 0) + 1,
      lastReminderMessage: msg,
    })
  }
  return NextResponse.json({ status: 'success', sent, skipped, recent })
}
