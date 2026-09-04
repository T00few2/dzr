import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { unwrapChatNoteDoc, type CoachChatNoteKind } from '@/app/lib/tokenCrypto'

export const COACH_CHAT_NOTES_COLLECTION = COLLECTIONS.coachChatNotes || 'coach_chat_notes'
export const COACH_CHAT_NOTES_SUBCOLLECTION = 'notes'

export type CoachChatNote = {
  id: string
  at: string | null
  text: string
  kind: CoachChatNoteKind
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
    }
  } catch {
    return null
  }
}
