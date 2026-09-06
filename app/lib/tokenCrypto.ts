/**
 * Coach/Strava encryption for the Next.js site.
 *
 * The crypto itself now lives in packages/shared/coach/tokenCrypto.js, which is the single source
 * of truth and is copied into apps/bot by `npm run sync:shared`. This file re-exports it so the
 * eleven existing import sites are unchanged, and adds the two helpers that only the site needs.
 *
 * It previously held a full TypeScript reimplementation kept byte-compatible with the bot's copy
 * by hand — the two had to agree exactly or coach memory written by one runtime became unreadable
 * by the other, and nothing enforced that. CI now fails if the copies drift.
 */
export type {
  CoachStyle,
  CoachInjury,
  CoachWeeklySlot,
  CoachMemoryPlain,
  CoachChatNotePlain,
  CoachChatNoteKind,
} from '@/packages/shared/coach/tokenCrypto'

export {
  PREFIX,
  COACH_CANARY_PLAINTEXT,
  canEncryptTokens,
  canEncryptCoachMemory,
  encryptSecret,
  decryptSecret,
  readStravaTokens,
  hasStravaRefreshToken,
  encryptedTokenFields,
  needsTokenMigration,
  unwrapCoachMemoryDoc,
  persistCoachMemoryDoc,
  unwrapChatNoteDoc,
  persistChatNoteDoc,
  makeCoachCanary,
  verifyCoachCanary,
} from '@/packages/shared/coach/tokenCrypto'

/**
 * Field names that must never be shown in the admin Firestore browser.
 * Site-only: the bot has no generic document viewer.
 */
export const SECRET_DOC_KEYS = [
  'accessToken',
  'refreshToken',
  'accessTokenEnc',
  'refreshTokenEnc',
  'memoryEnc',
  'noteEnc',
  'privateKey',
  'idToken',
  'clientSecret',
] as const

export function redactSecrets<T extends Record<string, any>>(data: T): T {
  const out: Record<string, any> = { ...data }
  for (const key of SECRET_DOC_KEYS) {
    if (key in out && out[key]) out[key] = '[redacted]'
  }
  return out as T
}
