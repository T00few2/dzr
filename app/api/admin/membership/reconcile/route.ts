import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { botHeaders, guildId } from '@/app/api/admin/_lib/discord'

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const settings = await adminDb.collection(COLLECTIONS.systemSettings).doc('global').get()
  const roleId = String(settings.data()?.membership?.clubMemberRoleId || '').trim()
  if (!roleId) return NextResponse.json({ error: 'Club Member Role ID not configured' }, { status: 400 })

  const paymentsSnap = await adminDb.collection(COLLECTIONS.payments).limit(100000).get()
  const currentYear = new Date().getUTCFullYear()
  const userToMax: Record<string, number> = {}
  paymentsSnap.docs.forEach((d) => {
    const p: any = d.data()
    if (String(p.status || '').toLowerCase() !== 'succeeded') return
    const userId = String(p.userId || '').trim()
    const covered = p.coveredThroughYear
    if (!userId || typeof covered !== 'number') return
    if (!(userId in userToMax) || covered > userToMax[userId]) userToMax[userId] = covered
  })

  const membershipsSnap = await adminDb.collection(COLLECTIONS.memberships).limit(100000).get()
  const userIds = new Set<string>([
    ...membershipsSnap.docs.map((d) => String(d.data()?.userId || d.id).trim()),
    ...Object.keys(userToMax),
  ])

  const result = { updated_memberships: 0, roles_added: 0, roles_removed: 0, errors: 0, total_users: userIds.size }
  const headers = botHeaders()
  const gid = guildId()

  for (const uid of userIds) {
    if (!uid) continue
    const covered = userToMax[uid]
    const status = typeof covered === 'number' && covered >= currentYear ? 'club' : 'community'
    try {
      await adminDb.collection(COLLECTIONS.memberships).doc(uid).set({
        userId: uid,
        currentStatus: status,
        coveredThroughYear: typeof covered === 'number' ? covered : null,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      result.updated_memberships += 1
    } catch {
      result.errors += 1
    }
    try {
      const url = `https://discord.com/api/v10/guilds/${gid}/members/${uid}/roles/${roleId}`
      if (status === 'club') {
        const r = await fetch(url, { method: 'PUT', headers })
        if (r.ok) result.roles_added += 1
        else if (![403, 404].includes(r.status)) result.errors += 1
      } else {
        const r = await fetch(url, { method: 'DELETE', headers })
        if ([200, 202, 204, 404].includes(r.status)) result.roles_removed += 1
        else result.errors += 1
      }
    } catch {
      result.errors += 1
    }
  }

  return NextResponse.json(result)
}
