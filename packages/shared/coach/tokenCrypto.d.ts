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

export type CoachWeeklyDay = { day: string; startTime: string | null }
export type CoachWeeklySlot = { sport: string; days: CoachWeeklyDay[] }

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

/** Short non-reversible fingerprint of the configured key, or null when none is set. */
export function coachKeyId(): string | null
export function tokenKeyId(): string | null
/** 'unknown' for documents predating keyId — never treat that as a mismatch. */
export function compareKeyId(
  storedKeyId: string | null | undefined,
  currentKeyId: string | null | undefined
): 'match' | 'mismatch' | 'unknown' | 'no_key'

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

export type CalendarEntryKind = 'session' | 'race' | 'event' | 'other'
export type CalendarEntrySource = 'member' | 'coach'
export type CalendarEntryStatus = 'planned' | 'done' | 'skipped'

export interface CalendarEntryPlain {
  id?: string | null
  discordId?: string | null
  eventDate: string
  text: string
  kind?: CalendarEntryKind
  startTime?: string | null
  source?: CalendarEntrySource
  status?: CalendarEntryStatus
  sourceEventId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** Throws if the coach key is missing or the stored value cannot be decrypted. */
export function unwrapCalendarEntryDoc(data: Record<string, unknown> | null | undefined): {
  id: string | null
  discordId: string | null
  eventDate: string | null
  source: CalendarEntrySource
  status: CalendarEntryStatus
  createdAt: string | null
  updatedAt: string | null
  text: string
  kind: CalendarEntryKind
  startTime: string | null
  sourceEventId: string | null
}
export function persistCalendarEntryDoc(plain: CalendarEntryPlain): Record<string, unknown>

/** Encrypt/verify the fixed canary string used to detect key drift at bot startup. */
export function makeCoachCanary(): string
export function verifyCoachCanary(value: unknown): boolean
