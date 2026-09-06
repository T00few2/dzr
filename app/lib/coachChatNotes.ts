import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { unwrapChatNoteDoc, type CoachChatNoteKind } from '@/app/lib/tokenCrypto'

export const COACH_CHAT_NOTES_COLLECTION = COLLECTIONS.coachChatNotes || 'coach_chat_notes'
export const COACH_CHAT_NOTES_SUBCOLLECTION = 'notes'
// Single source of truth, shared with the bot: it prunes to this and the web path refuses past
// it, or notes grow beyond what listNotes() reads back and older goals silently vanish from the
// coach prompt.
export { MAX_NOTES_PER_ATHLETE } from '@/packages/shared/coach/coachChatNotes'
export { MAX_ACTIVE_GOALS, activeGoalNotes, sanitizeGoalEventDate } from '@/app/lib/coachGoals'

export type CoachChatNote = {
  id: string
  at: string | null
  text: string
  kind: CoachChatNoteKind
  eventDate?: string | null
}

export function toClientCoachChatNote(
  data: Record<string, unknown> | null | undefined,
  id: string
): CoachChatNote | null {
  try {
    const note = unwrapChatNoteDoc({ ...(data || {}), id })
    const text = String(note.text || '').trim()
    if (!text) return null
    return {
      id,
      at: note.at,
      text,
      kind: note.kind,
      eventDate: note.eventDate || null,
    }
  } catch {
    return null
  }
}
