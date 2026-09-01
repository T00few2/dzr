import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const snap = await adminDb.collection(COLLECTIONS.serverActivity)
    .where('timestamp', '>=', start.toISOString() + 'Z')
    .where('timestamp', '<=', end.toISOString() + 'Z')
    .limit(500)
    .get()
    .catch(async () => adminDb.collection(COLLECTIONS.serverActivity).limit(200).get())

  const activities = snap.docs.map((d) => d.data() as any)
  const total_messages = activities.reduce((s, a) => s + Number(a?.rawData?.messageCount || 0), 0)
  const total_reactions = activities.reduce((s, a) => s + Number(a?.rawData?.reactionCount || 0), 0)
  const total_voice = activities.reduce((s, a) => s + Number(a?.rawData?.voiceActivityCount || 0), 0)
  const total_interactions = activities.reduce((s, a) => s + Number(a?.rawData?.interactionCount || 0), 0)
  const users = new Set<string>()
  const channels = new Set<string>()
  activities.forEach((a) => {
    Object.keys(a?.summary?.userActivity || {}).forEach((k) => users.add(k))
    Object.keys(a?.summary?.channelActivity || {}).forEach((k) => channels.add(k))
  })
  return NextResponse.json({
    days: activities.length,
    total_messages,
    total_reactions,
    total_voice,
    total_interactions,
    unique_users: users.size,
    unique_channels: channels.size,
    recent: activities.slice(0, 20).map((a) => ({
      dateKey: a.dateKey,
      timestamp: a.timestamp,
      totalActivities: a.totalActivities,
    })),
  })
}
