import { adminDb } from '@/app/utils/firebaseAdminConfig'
import {
  COACH_PROFILES_COLLECTION,
  defaultCoachProfile,
  toClientCoachProfile,
} from '@/app/lib/coachProfile'
import { persistCoachMemoryDoc } from '@/app/lib/tokenCrypto'

function profileRef(discordId: string) {
  return adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId)
}

export async function ensureDefaultCoachProfile(discordId: string) {
  const id = String(discordId || '').trim()
  if (!id) return null
  const ref = profileRef(id)
  const snap = await ref.get()
  if (snap.exists) {
    return toClientCoachProfile({ ...(snap.data() || {}), discordId: id }, id)
  }
  const fields = defaultCoachProfile()
  const now = new Date()
  await ref.set(
    persistCoachMemoryDoc({
      discordId: id,
      ...fields,
      updatedAt: now,
      updatedBy: 'user',
      howItWorksSentAt: null,
    })
  )
  return toClientCoachProfile({ ...fields, discordId: id, updatedAt: now, updatedBy: 'user' }, id)
}
