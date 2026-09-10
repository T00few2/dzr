// Types for the shared CommonJS coach-profile sanitisers.
// Hand-written so the Next.js site keeps full typing; see tokenCrypto.d.ts for the rationale.

export type CoachStyleLength = 'short' | 'normal' | 'detailed'
export type CoachStyleLanguage = 'da' | 'en'
export type CoachStyleTone = 'direct' | 'encouraging' | 'casual'
export type CoachFollowUpDays = 3 | 7 | 14

export type CoachStyle = {
  length: CoachStyleLength | null
  language: CoachStyleLanguage | null
  tone: CoachStyleTone | null
  notes: string
}

export type CoachWeeklySlot = { sport: string; days: string[]; startTime: string | null }

export type CoachInjury = {
  id: string
  text: string
  started: string | null
  status: 'active' | 'recovered'
}

export type CoachProfile = {
  ridesPerWeek: { min?: number; max?: number } | null
  sports: string[]
  weekly: CoachWeeklySlot[]
  injuries: CoachInjury[]
  goals: string[]
  style: CoachStyle
  notesOptIn: boolean
  followUpEveryDays: CoachFollowUpDays | null
}

/** Normalise arbitrary input into the stored shape. Unknown values become null, not errors. */
export function publicFields(data: unknown): CoachProfile
export function emptyStyle(): CoachStyle
export function emptyProfile(): CoachProfile
/** Seeded on first /coach. Note style.language is null so the coach matches the athlete's language. */
export function defaultProfile(): CoachProfile
export function sanitizeFollowUpEveryDays(value: unknown): CoachFollowUpDays | null
/** Bot-only: renders the settings block injected into the coach system prompt. */
export function formatCoachProfileForPrompt(profile: unknown): string
