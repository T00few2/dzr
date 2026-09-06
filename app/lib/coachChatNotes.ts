import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { unwrapChatNoteDoc, type CoachChatNoteKind } from '@/app/lib/tokenCrypto'

export const COACH_CHAT_NOTES_COLLECTION = COLLECTIONS.coachChatNotes || 'coach_chat_notes'
export const COACH_CHAT_NOTES_SUBCOLLECTION = 'notes'
export const MAX_ACTIVE_GOALS = 3
const COACH_TZ = 'Europe/Copenhagen'

export type CoachChatNote = {
  id: string
  at: string | null
  text: string
  kind: CoachChatNoteKind
  eventDate?: string | null
}

function calendarDateInTz(value: Date | string = new Date(), tz = COACH_TZ) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(date)
}

export function sanitizeGoalEventDate(value: unknown, now = new Date()): string | null {
  const iso = String(value || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  if (!Number.isFinite(Date.parse(`${iso}T00:00:00Z`))) return null
  const today = calendarDateInTz(now)
  if (!today || iso < today) return null
  const maxYear = Number(today.slice(0, 4)) + 2
  if (iso.slice(0, 4) > String(maxYear)) return null
  return iso
}

export function activeGoalNotes(notes: CoachChatNote[], now = new Date()): CoachChatNote[] {
  const today = calendarDateInTz(now)
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => {
      if (note?.kind !== 'goal' || !note.text) return false
      const eventDate = sanitizeGoalEventDate(note.eventDate, now)
      return Boolean(eventDate && eventDate >= today)
    })
    .sort((a, b) => String(a.eventDate || '').localeCompare(String(b.eventDate || '')))
    .slice(0, MAX_ACTIVE_GOALS)
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
