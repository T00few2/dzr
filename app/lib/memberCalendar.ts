/**
 * Member calendar helpers for the Next.js site.
 *
 * Re-export shim over packages/shared/coach/memberCalendar.js, which is the single source of
 * truth and is copied into apps/bot by `npm run sync:shared`. Same arrangement as
 * app/lib/coachChatNotes.ts — the site imports the shared module, the bot gets a synced copy, and
 * CI fails if they drift.
 */
import { COLLECTIONS } from '@/app/lib/sharedConstants'

export type { CalendarEntry } from '@/packages/shared/coach/memberCalendar'

export {
  ENTRY_KINDS,
  ENTRY_SOURCES,
  ENTRY_STATUSES,
  MAX_ENTRY_TEXT,
  MAX_ENTRIES_PER_MEMBER,
  MAX_COACH_ENTRIES_PER_WEEK,
  DEFAULT_HORIZON_DAYS,
  sanitizeEntryKind,
  sanitizeEntrySource,
  sanitizeEntryStatus,
  sanitizeStartTime,
  sanitizeSourceEventId,
  sanitizeCalendarEntry,
  upcomingEntries,
  formatCalendarForPrompt,
  countRecentCoachEntries,
} from '@/packages/shared/coach/memberCalendar'

export const MEMBER_CALENDAR_COLLECTION = COLLECTIONS.memberCalendar || 'member_calendar'
export const MEMBER_CALENDAR_SUBCOLLECTION = 'entries'
