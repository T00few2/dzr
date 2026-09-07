// Types for the shared chat-note module. Only the members the site uses are declared precisely;
// the bot-only prompt/extraction helpers are declared loosely on purpose.

export type CoachGoalLike = {
  id?: string
  text?: string
  kind?: string
  eventDate?: string | null
}

export const MAX_ACTIVE_GOALS: number
export const MAX_NOTE_TEXT: number
export const MAX_NOTES_PER_ATHLETE: number
export const MAX_NOTES_PER_WRITE: number
export const NOTE_KINDS: string[]
export const EPISODE_NOTE_KINDS: string[]

/** Null unless the date is YYYY-MM-DD, today or later, and within two years. */
export function sanitizeEventDate(value: unknown, now?: Date): string | null

/** Calendar date in Europe/Copenhagen ("YYYY-MM-DD"), not the server's timezone. */
export function calendarDateInTz(value: Date | string | number, tz?: string): string
export function addIsoDays(iso: string, days: number): string
/** "tomorrow", "in 3 weeks", "2 days ago"; empty string when the date is unparseable. */
export function formatDaysUntil(eventDate: unknown, now?: Date): string

/** Goals that are still live: correct kind, non-empty text, unexpired date. Capped and sorted. */
export function activeGoalNotes<T extends CoachGoalLike>(notes: T[], now?: Date): T[]

export function formatCoachToday(now?: Date): {
  iso: string
  weekday: string
  longDate: string
  time: string
  tz: string
  weekMonday: string | null
  weekSunday: string | null
  line: string
}
export function formatNoteAge(at: unknown, now?: Date): string
export function isNearDuplicate(text: string, notes: unknown[]): boolean
export function sanitizeNote(raw: unknown, fallbackAt?: unknown, now?: Date): unknown
export function shouldSkipExtract(userMessage: unknown): boolean
export function parseExtractedNotes(rawText: unknown, fallbackAt?: unknown): unknown[]
export function retrieveRelevantNotes(notes: unknown[], query: string, options?: Record<string, unknown>): unknown[]
export function searchNotes(notes: unknown[], query: string, options?: Record<string, unknown>): unknown[]
export function formatActiveGoalsForPrompt(notes: unknown[], now?: Date): string
export function formatNotesForPrompt(notes: unknown[], now?: Date): string
export function formatNoteDate(at: unknown): string
export function buildExtractMessages(input: Record<string, unknown>): unknown[]
