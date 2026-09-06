import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { unwrapChatNoteDoc, type CoachChatNoteKind } from '@/app/lib/tokenCrypto'

export const COACH_CHAT_NOTES_COLLECTION = COLLECTIONS.coachChatNotes || 'coach_chat_notes'
export const COACH_CHAT_NOTES_SUBCOLLECTION = 'notes'
// Mirrors MAX_NOTES_PER_ATHLETE in apps/bot/services/coachChatNotes.js. The bot prunes to
// this; the web path must refuse past it, or notes grow beyond what listNotes() reads back
// and older goals silently vanish from the coach prompt.
export const MAX_NOTES_PER_ATHLETE = 200
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
