import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { sendCoachDm } from '@/app/api/admin/_lib/discord'
import { clearCoachProfileAndNotes } from '@/app/lib/clearCoachData'
import { STRAVA_DELETION_DM } from '@/app/lib/stravaCoachLinks'
import { revokeStravaGrant, STRAVA_CONNECTIONS_COLLECTION } from '@/app/lib/stravaAuth'
import { readStravaTokens } from '@/app/lib/tokenCrypto'

export async function wipeCoachStravaForDiscordId(
  discordId: string,
  { revokeOnStrava = false, notifyUser = true }: { revokeOnStrava?: boolean; notifyUser?: boolean } = {}
): Promise<{ revokedOnStrava: boolean; notified: boolean }> {
  const id = String(discordId || '').trim()
  if (!id) return { revokedOnStrava: false, notified: false }

  await clearCoachProfileAndNotes(id)

  const ref = adminDb.collection(STRAVA_CONNECTIONS_COLLECTION).doc(id)
  const snap = await ref.get()
  let revokedOnStravaResult = false

  if (snap.exists) {
    const data = snap.data() || {}
    if (revokeOnStrava) {
      try {
        const tokens = readStravaTokens(data)
        revokedOnStravaResult = await revokeStravaGrant({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Number(data.expiresAt) || 0,
        })
      } catch (err) {
        console.warn('wipeCoachStrava: could not revoke Strava grant', err)
      }
    }
    await ref.delete()
  }

  let notified = false
  if (notifyUser) {
    try {
      notified = await sendCoachDm(id, STRAVA_DELETION_DM)
    } catch (err) {
      console.warn('wipeCoachStrava: deletion DM failed', err)
    }
  }

  return { revokedOnStrava: revokedOnStravaResult, notified }
}
