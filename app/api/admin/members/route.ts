import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS, COMMUNITY_MEMBER_ROLE_ID } from '@/app/lib/sharedConstants'
import { listGuildMembers } from '@/app/api/admin/_lib/discord'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'all'
  const members = await listGuildMembers(5000)
  const usersSnap = await adminDb.collection(COLLECTIONS.users).limit(100000).get()
  const userByDiscord: Record<string, any> = {}
  usersSnap.docs.forEach((d) => {
    const u = d.data() || {}
    userByDiscord[String(u.discordId || d.id)] = { id: d.id, ...u }
  })
  const companion = new Set((await adminDb.collection(COLLECTIONS.companionClubMembers).listDocuments()).map((d) => d.id))
  const zp = new Set((await adminDb.collection(COLLECTIONS.zwiftpowerClubMembers).listDocuments()).map((d) => d.id))

  const out = members.map((m: any) => {
    const discordID = String(m.user?.id || '')
    const user = userByDiscord[discordID] || {}
    const role_ids = (m.roles || []).map(String)
    const zwiftId = String(user.zwiftId || '').trim()
    return {
      discordID,
      username: m.user?.username || '',
      displayName: m.nick || m.user?.global_name || m.user?.username || '',
      avatar: m.user?.avatar || null,
      role_ids,
      zwiftId,
      has_member_role: role_ids.includes(COMMUNITY_MEMBER_ROLE_ID),
      in_companion: zwiftId ? companion.has(zwiftId) : false,
      in_zwiftpower: zwiftId ? zp.has(zwiftId) : false,
    }
  })
  const filtered = type === 'linked'
    ? out.filter((m) => m.zwiftId)
    : type === 'unlinked'
      ? out.filter((m) => !m.zwiftId)
      : out
  return NextResponse.json({ members: filtered, total: filtered.length })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const discordId = String(body.discordId || '').trim()
  const zwiftId = String(body.zwiftId || '').trim()
  if (!discordId || !zwiftId) return NextResponse.json({ error: 'discordId and zwiftId required' }, { status: 400 })
  await adminDb.collection(COLLECTIONS.users).doc(discordId).set({
    discordId,
    zwiftId,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
  return NextResponse.json({ ok: true })
}
