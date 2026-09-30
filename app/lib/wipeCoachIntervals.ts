import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { sendCoachDm } from '@/app/api/admin/_lib/discord'
import { clearCoachProfileAndNotes } from '@/app/lib/clearCoachData'
import { INTERVALS_DELETION_DM } from '@/app/lib/intervalsCoachLinks'
import { INTERVALS_CONNECTIONS_COLLECTION } from '@/app/lib/intervalsAuth'

const WEEKLY_LOAD = 'coach_weekly_load'
const ACTIVITY_METRICS = 'coach_activity_metrics'

async function deleteActivityMetrics(discordId: string) {
  const col = adminDb.collection(ACTIVITY_METRICS)
  while (true) {
    const snap = await col.where('discordId', '==', discordId).limit(400).get()
    if (snap.empty) break
    const batch = adminDb.batch()
    snap.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    if (snap.size < 400) break
  }
}

export async function wipeCoachIntervalsForDiscordId(
  discordId: string,
  { notifyUser = true }: { notifyUser?: boolean } = {}
): Promise<{ notified: boolean }> {
  const id = String(discordId || '').trim()
  if (!id) return { notified: false }

  await clearCoachProfileAndNotes(id)
  await adminDb.collection(INTERVALS_CONNECTIONS_COLLECTION).doc(id).delete().catch(() => undefined)
  await adminDb.collection(WEEKLY_LOAD).doc(id).delete().catch(() => undefined)
  await deleteActivityMetrics(id).catch((err) => {
    console.warn('wipeCoachIntervals: activity metrics delete failed', err)
  })

  let notified = false
  if (notifyUser) {
    try {
      notified = await sendCoachDm(id, INTERVALS_DELETION_DM)
    } catch (err) {
      console.warn('wipeCoachIntervals: deletion DM failed', err)
    }
  }
  return { notified }
}
