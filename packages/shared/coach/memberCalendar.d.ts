import type { CalendarEntryKind, CalendarEntrySource, CalendarEntryStatus } from './tokenCrypto'

export interface CalendarEntry {
  id?: string | null
  eventDate: string
  text: string
  kind: CalendarEntryKind
  startTime: string | null
  source: CalendarEntrySource
  status: CalendarEntryStatus
  sourceEventId: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export const ENTRY_KINDS: readonly CalendarEntryKind[]
export const ENTRY_SOURCES: readonly CalendarEntrySource[]
export const ENTRY_STATUSES: readonly CalendarEntryStatus[]
export const MAX_ENTRY_TEXT: number
export const MAX_ENTRIES_PER_MEMBER: number
export const MAX_COACH_ENTRIES_PER_WEEK: number
export const DEFAULT_HORIZON_DAYS: number

export function sanitizeEntryKind(value: unknown): CalendarEntryKind
export function sanitizeEntrySource(value: unknown): CalendarEntrySource
export function sanitizeEntryStatus(value: unknown): CalendarEntryStatus
/** "HH:MM" local wall clock, or null. */
export function sanitizeStartTime(value: unknown): string | null
export function sanitizeSourceEventId(value: unknown): string | null

/** Null when the text is empty or the date is not a valid future date. */
export function sanitizeCalendarEntry(
  raw: unknown,
  now?: Date
): Omit<CalendarEntry, 'id' | 'createdAt' | 'updatedAt'> | null

/** Today (Europe/Copenhagen) through the horizon, soonest first. */
export function upcomingEntries<T extends { eventDate?: string | null; startTime?: string | null }>(
  entries: T[] | null | undefined,
  now?: Date,
  horizonDays?: number
): T[]

/** Upcoming entries, one per line. Empty string when there is nothing in the horizon. */
export function formatCalendarForPrompt(
  entries: CalendarEntry[] | null | undefined,
  now?: Date
): string

export function countRecentCoachEntries(
  entries: Array<{ source?: string; createdAt?: string | null }> | null | undefined,
  now?: Date
): number
