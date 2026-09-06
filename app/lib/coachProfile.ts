/**
 * Coach settings for the Next.js site.
 *
 * The sanitisers live in packages/shared/coach/coachProfile.js — the single source of truth,
 * copied into apps/bot by `npm run sync:shared`. They decide what a member's stored settings
 * actually mean, so a divergence between the two runtimes would have the bot and the website
 * normalising the same profile differently. CI fails if the copies drift.
 *
 * This file re-exports them under the site's existing names so no call site changes, and adds
 * the two things only the site needs: the collection constant and the client-shaped view.
 */
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { unwrapCoachMemoryDoc } from '@/app/lib/tokenCrypto'
import {
  publicFields,
  emptyProfile,
  defaultProfile,
  emptyStyle as sharedEmptyStyle,
} from '@/packages/shared/coach/coachProfile'

export type {
  CoachStyle,
  CoachStyleLength,
  CoachStyleLanguage,
  CoachStyleTone,
  CoachWeeklySlot,
  CoachInjury,
  CoachFollowUpDays,
  CoachProfile,
} from '@/packages/shared/coach/coachProfile'

export { sanitizeFollowUpEveryDays } from '@/packages/shared/coach/coachProfile'

export const COACH_PROFILES_COLLECTION = COLLECTIONS.coachProfiles || 'coach_profiles'

// Site-facing aliases for the shared sanitisers.
export const publicCoachFields = publicFields
export const emptyCoachProfile = emptyProfile
export const defaultCoachProfile = defaultProfile
export const emptyStyle = sharedEmptyStyle

/** Decrypt a stored profile and shape it for the members-zone editor. */
export function toClientCoachProfile(data: unknown, discordId: string) {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const src = unwrapCoachMemoryDoc({ ...raw, discordId })
  const fields = publicCoachFields(src)
  return {
    ...fields,
    discordId,
    updatedAt: src.updatedAt ?? null,
    updatedBy: 'user' as const,
    howItWorksSentAt: src.howItWorksSentAt ?? null,
  }
}
