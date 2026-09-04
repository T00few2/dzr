import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { sendDm } from '@/app/api/admin/_lib/discord'
import {
  COACH_PROFILES_COLLECTION,
  defaultCoachProfile,
  publicCoachFields,
  toClientCoachProfile,
} from '@/app/lib/coachProfile'
import { persistCoachMemoryDoc, unwrapCoachMemoryDoc } from '@/app/lib/tokenCrypto'
import { coachHowItWorksText } from '@/app/lib/coachHowItWorks'

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
      pendingConfirmation: null,
      updatedAt: now,
      updatedBy: 'user',
      howItWorksSentAt: null,
    })
  )
  return toClientCoachProfile({ ...fields, discordId: id, updatedAt: now, updatedBy: 'user' }, id)
}

export async function sendCoachHowItWorksIfNeeded(discordId: string) {
  const id = String(discordId || '').trim()
  if (!id) return
  try {
    await ensureDefaultCoachProfile(id)
    const ref = profileRef(id)
    const snap = await ref.get()
    const existing = unwrapCoachMemoryDoc({ ...(snap.exists ? snap.data() || {} : {}), discordId: id })
    if (existing.howItWorksSentAt) return
    const ok = await sendDm(id, coachHowItWorksText({ includeStartHint: true }))
    if (!ok) {
      console.warn('coach how-it-works DM failed for', id)
      return
    }
    const fields = publicCoachFields(existing, existing.updatedBy === 'coach' ? 'coach' : 'user')
    await ref.set(
      persistCoachMemoryDoc({
        discordId: id,
        ...fields,
        pendingConfirmation: existing.pendingConfirmation || null,
        updatedAt: existing.updatedAt || new Date(),
        updatedBy: existing.updatedBy === 'user' || existing.updatedBy === 'coach' ? existing.updatedBy : 'user',
        howItWorksSentAt: new Date().toISOString(),
      })
    )
  } catch (err: any) {
    console.warn('sendCoachHowItWorksIfNeeded failed:', err?.message || err)
  }
}
