import { adminDb } from '@/app/utils/firebaseAdminConfig'
import {
  COACH_CHAT_NOTES_COLLECTION,
  COACH_CHAT_NOTES_SUBCOLLECTION,
} from '@/app/lib/coachChatNotes'
import {
  COACH_PROFILES_COLLECTION,
  defaultCoachProfile,
} from '@/app/lib/coachProfile'
import { persistCoachMemoryDoc, unwrapCoachMemoryDoc } from '@/app/lib/tokenCrypto'

function notesCol(discordId: string) {
  return adminDb.collection(COACH_CHAT_NOTES_COLLECTION).doc(discordId).collection(COACH_CHAT_NOTES_SUBCOLLECTION)
}

export async function deleteAllCoachChatNotes(discordId: string) {
  const id = String(discordId || '').trim()
  if (!id) return
  const col = notesCol(id)
  while (true) {
    const snap = await col.limit(400).get()
    if (snap.empty) break
    const batch = adminDb.batch()
    snap.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    if (snap.size < 400) break
  }
  await adminDb.collection(COACH_CHAT_NOTES_COLLECTION).doc(id).delete().catch(() => undefined)
}

export async function resetCoachProfileToDefault(discordId: string) {
  const id = String(discordId || '').trim()
  if (!id) return
  const ref = adminDb.collection(COACH_PROFILES_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return
  const existing = unwrapCoachMemoryDoc({ ...(snap.data() || {}), discordId: id })
  const reset = defaultCoachProfile()
  const now = new Date()
  await ref.set(
    persistCoachMemoryDoc({
      discordId: id,
      ...reset,
      updatedAt: now,
      updatedBy: 'user',
      howItWorksSentAt: null,
    })
  )
}

export async function clearCoachProfileAndNotes(discordId: string) {
  const id = String(discordId || '').trim()
  if (!id) return
  await deleteAllCoachChatNotes(id)
  await resetCoachProfileToDefault(id)
}
