import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { listGuildRoles, listGuildChannels, guildId } from '@/app/api/admin/_lib/discord'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const [roles, channels, panelsDoc] = await Promise.all([
    listGuildRoles(),
    listGuildChannels(),
    adminDb.collection(COLLECTIONS.selfRoles).doc(guildId()).get(),
  ])
  const panelsObj = panelsDoc.exists ? (panelsDoc.data()?.panels || {}) : {}
  const panels = Object.entries(panelsObj).map(([panelId, panel]: [string, any]) => ({
    panelId,
    ...panel,
  }))
  return NextResponse.json({ roles, channels, panels })
}

export async function PUT(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const panels = body.panels
  if (!panels || typeof panels !== 'object') {
    return NextResponse.json({ error: 'panels object required' }, { status: 400 })
  }
  await adminDb.collection(COLLECTIONS.selfRoles).doc(guildId()).set({
    panels,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
  return NextResponse.json({ ok: true })
}
