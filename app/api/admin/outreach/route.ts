import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { sendDm } from '@/app/api/admin/_lib/discord'
import { adminDb } from '@/app/utils/firebaseAdminConfig'

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
  for (const item of members) {
    const discordId = String(item?.discord_id || '').trim()
    const username = String(item?.username || '')
    if (!discordId) { skipped += 1; continue }
    const msg = messageTemplate.replaceAll('{{username}}', username)
    const ok = await sendDm(discordId, msg)
    if (!ok) { skipped += 1; continue }
    sent += 1
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
  return NextResponse.json({ status: 'success', sent, skipped })
}
