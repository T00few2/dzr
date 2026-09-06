// Types for the shared CommonJS crypto module.
//
// Written by hand so the Next.js site keeps full type checking on coach encryption. Without
// this, `allowJs` would resolve the .js file as `any` and the site would silently lose the
// types it had when tokenCrypto.ts was a separate TypeScript copy.

export type CoachStyle = {
  length: 'short' | 'normal' | 'detailed' | null
  language: 'da' | 'en' | null
  tone: 'direct' | 'encouraging' | 'casual' | null
  notes: string
}

export type CoachInjury = {
  id: string
  text: string
  started: string | null
  status: 'active' | 'recovered'
}

export type CoachWeeklySlot = { sport: string; days: string[] }

export type CoachMemoryPlain = {
  discordId?: string | null
  ridesPerWeek?: { min?: number; max?: number } | null
  sports?: string[]
  weekly?: CoachWeeklySlot[]
  injuries?: CoachInjury[]
  goals?: unknown[]
  style?: CoachStyle
  notesOptIn?: boolean
  followUpEveryDays?: 3 | 7 | 14 | null
  updatedAt?: unknown
  updatedBy?: string | null
  howItWorksSentAt?: string | null
  lastAthleteMessageAt?: string | null
  lastFollowUpAt?: string | null
}

/** The kinds a chat note may carry. `goal` is only reachable via explicit confirmation. */
export type CoachChatNoteKind = 'feeling' | 'plan' | 'preference_transient' | 'life' | 'race' | 'goal'

export type CoachChatNotePlain = {
  discordId?: string | null
  at?: unknown
  text?: string
  kind?: CoachChatNoteKind | string
  eventDate?: string | null
}

export const PREFIX: string
export const COACH_CANARY_PLAINTEXT: string

/** True when a key is configured. Note this proves a key *exists*, not that two runtimes agree. */
export function canEncryptTokens(): boolean
export function canEncryptCoachMemory(): boolean

/** Throws rather than returning plaintext when no key is configured. */
export function encryptSecret(plaintext: string): string
export function decryptSecret(value: unknown): string

export function readStravaTokens(data: Record<string, unknown> | null | undefined): {
  accessToken: string
  refreshToken: string
}
export function hasStravaRefreshToken(data: Record<string, unknown> | null | undefined): boolean
export function encryptedTokenFields(
  accessToken: string,
  refreshToken: string
): { accessTokenEnc: string; refreshTokenEnc: string; tokenEncVersion: number }
export function needsTokenMigration(data: Record<string, unknown> | null | undefined): boolean

/** Throws if the coach key is missing or a stored value cannot be decrypted. */
export function unwrapCoachMemoryDoc(data: Record<string, unknown> | null | undefined): CoachMemoryPlain
export function persistCoachMemoryDoc(plain: CoachMemoryPlain): Record<string, unknown>
export function unwrapChatNoteDoc(data: Record<string, unknown> | null | undefined): {
  id: string | null
  discordId: string | null
  at: string | null
  text: string
  /** Unrecognised kinds are coerced to 'life' by packChatNote, so this union is exhaustive. */
  kind: CoachChatNoteKind
  eventDate: string | null
}
export function persistChatNoteDoc(plain: CoachChatNotePlain): Record<string, unknown>

/** Encrypt/verify the fixed canary string used to detect key drift at bot startup. */
export function makeCoachCanary(): string
export function verifyCoachCanary(value: unknown): boolean
