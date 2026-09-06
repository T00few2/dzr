/**
 * Goal validity for the Next.js site.
 *
 * The logic lives in packages/shared/coach/coachChatNotes.js — the single source of truth,
 * copied into apps/bot by `npm run sync:shared`. It decides whether a goal is still live, and
 * therefore whether the coach steers training toward it. If the two runtimes disagreed, the
 * website and the coach would disagree about which goals exist.
 *
 * Re-exported here under the site's existing names so no call site changes.
 */
import { sanitizeEventDate, activeGoalNotes as sharedActiveGoalNotes } from '@/packages/shared/coach/coachChatNotes'

export type { CoachGoalLike } from '@/packages/shared/coach/coachChatNotes'
export { MAX_ACTIVE_GOALS } from '@/packages/shared/coach/coachChatNotes'

/** Null unless the date is YYYY-MM-DD, today or later, and within two years. */
export const sanitizeGoalEventDate = sanitizeEventDate

/** Goals that are still live: correct kind, non-empty text, unexpired date. Capped and sorted. */
export const activeGoalNotes = sharedActiveGoalNotes
