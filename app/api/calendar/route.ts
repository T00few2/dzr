import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole } from '@/app/lib/stravaAuth'
import {
  MEMBER_CALENDAR_COLLECTION,
  MEMBER_CALENDAR_SUBCOLLECTION,
  MAX_ENTRIES_PER_MEMBER,
  sanitizeCalendarEntry,
  sanitizeEntryStatus,
} from '@/app/lib/memberCalendar'
import {
  COACH_CHAT_NOTES_COLLECTION,
  COACH_CHAT_NOTES_SUBCOLLECTION,
  activeGoalNotes,
} from '@/app/lib/coachChatNotes'
import { unwrapCalendarEntryDoc, persistCalendarEntryDoc, unwrapChatNoteDoc } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The member calendar.
 *
 * Deliberately gated on the session alone, NOT on club membership. The page this replaces
 * (members-zone/racing/race-calendar) rendered for any logged-in member, and login already
 * requires the verified-member role, so club-gating here would take away access members have
 * today. Goals are the one club-only part, and they degrade to an empty list.
 *
 * This is not coach data: it is not gated on notesOptIn, and the coach data wipe must not touch
 * it. See app/lib/clearCoachData.ts, which is deliberately left alone.
 */

async function sessionMember(req: Request) {
  const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  const discordId = String((session as any)?.discordId || '').trim()
  return { discordId }
}

function entriesCol(discordId: string) {
  return adminDb
    .collection(MEMBER_CALENDAR_COLLECTION)
    .doc(discordId)
    .collection(MEMBER_CALENDAR_SUBCOLLECTION)
}

async function listEntries(discordId: string) {
  const snap = await entriesCol(discordId)
    .orderBy('eventDate', 'desc')
    .limit(MAX_ENTRIES_PER_MEMBER)
    .get()
  const out: any[] = []
  for (const doc of snap.docs) {
    try {
      out.push(unwrapCalendarEntryDoc({ ...(doc.data() || {}), id: doc.id }))
    } catch (err) {
      // One undecryptable row must not take the whole calendar down — the same degradation the
      // admin dashboard learned to do. It stays in Firestore; the member simply cannot see it.
      console.error('calendar: could not decrypt entry', doc.id, err)
    }
  }
  return out
}

/**
 * Active goals, shown on the calendar as read-only pins.
 *
 * A projection of coach notes, never a copy: goals are written and edited under My Pages (Coach),
 * and duplicating them into member_calendar would create two rows that could disagree.
 */
async function listGoals(discordId: string) {
  const snap = await adminDb
    .collection(COACH_CHAT_NOTES_COLLECTION)
    .doc(discordId)
    .collection(COACH_CHAT_NOTES_SUBCOLLECTION)
    .orderBy('at', 'desc')
    .limit(200)
    .get()
  const notes: any[] = []
  for (const doc of snap.docs) {
    try {
      notes.push(unwrapChatNoteDoc({ ...(doc.data() || {}), id: doc.id }))
    } catch (err) {
      console.error('calendar: could not decrypt note', doc.id, err)
    }
  }
  // Expired goals come back too, flagged. They are inert — activeGoalNotes filters them out of the
  // coach prompt — but they still occupy the per-athlete note budget, and the only other place to
  // delete them sits behind the chat-notes toggle. A member with notes off would have no way to
  // clear one at all, so the calendar carries them.
  const active = new Set(activeGoalNotes(notes).map((note: any) => note.id))
  return notes
    .filter((note: any) => note.kind === 'goal' && note.text && note.eventDate)
    .map((note: any) => ({
      id: note.id,
      text: note.text,
      eventDate: note.eventDate,
      expired: !active.has(note.id),
    }))
}

export async function GET(req: Request) {
  try {
    const { discordId } = await sessionMember(req)
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    // Club membership decides whether the goal form is offered at all — goals are coach memory,
    // and the coach comes with club membership. The calendar itself is open to every verified
    // member, so this is a per-section flag rather than a gate on the page.
    const isClubMember = await hasClubMemberRole(discordId)
    const [entries, goals] = await Promise.all([
      listEntries(discordId),
      isClubMember ? listGoals(discordId) : Promise.resolve([]),
    ])
    return NextResponse.json({ entries, goals, isClubMember })
  } catch (err) {
    console.error('calendar GET failed:', err)
    return NextResponse.json({ error: 'Kunne ikke hente kalenderen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { discordId } = await sessionMember(req)
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    // source is forced: this endpoint is the member acting on their own calendar. The coach writes
    // through the bot, which sets source itself — a client must not be able to claim to be it.
    const entry = sanitizeCalendarEntry({ ...body, source: 'member' })
    if (!entry) {
      return NextResponse.json(
        { error: 'Skriv en tekst og vælg en dato i fremtiden' },
        { status: 400 }
      )
    }

    const existing = await entriesCol(discordId).count().get()
    if (existing.data().count >= MAX_ENTRIES_PER_MEMBER) {
      return NextResponse.json(
        { error: `Du har nået grænsen på ${MAX_ENTRIES_PER_MEMBER} punkter. Slet nogle først.` },
        { status: 400 }
      )
    }

    await entriesCol(discordId).doc().set(persistCalendarEntryDoc({ ...entry, discordId }))
    // The parent document exists only so the subcollection has somewhere to hang and so an export
    // can enumerate members. Nothing is read from it — the entries are the data.
    await adminDb.collection(MEMBER_CALENDAR_COLLECTION).doc(discordId).set(
      { discordId, updatedAt: new Date() },
      { merge: true }
    )

    return NextResponse.json({ ok: true, entries: await listEntries(discordId) })
  } catch (err) {
    console.error('calendar POST failed:', err)
    return NextResponse.json({ error: 'Kunne ikke gemme' }, { status: 500 })
  }
}

/** Mark an entry done or skipped. The only mutable field — text and date are delete-and-re-add. */
export async function PATCH(req: Request) {
  try {
    const { discordId } = await sessionMember(req)
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const ref = entriesCol(discordId).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await ref.update({ status: sanitizeEntryStatus(body?.status), updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true, entries: await listEntries(discordId) })
  } catch (err) {
    console.error('calendar PATCH failed:', err)
    return NextResponse.json({ error: 'Kunne ikke opdatere' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { discordId } = await sessionMember(req)
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const url = new URL(req.url)
    const id = String(url.searchParams.get('id') || '').trim()
    const deleteAll = url.searchParams.get('all') === '1'

    if (id) {
      // Scoped to the caller's own subcollection, so an id from someone else's calendar simply
      // does not exist here — ownership is structural rather than checked.
      await entriesCol(discordId).doc(id).delete()
      return NextResponse.json({ ok: true, entries: await listEntries(discordId) })
    }

    if (!deleteAll) return NextResponse.json({ error: 'Specify id or all=1' }, { status: 400 })

    // The calendar's own delete. The coach data wipe deliberately does not reach this collection,
    // so without this a member would have no way to clear it in one go.
    const col = entriesCol(discordId)
    for (;;) {
      const snap = await col.limit(400).get()
      if (snap.empty) break
      const batch = adminDb.batch()
      snap.docs.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()
      if (snap.size < 400) break
    }
    await adminDb.collection(MEMBER_CALENDAR_COLLECTION).doc(discordId).delete().catch(() => undefined)
    return NextResponse.json({ ok: true, entries: [] })
  } catch (err) {
    console.error('calendar DELETE failed:', err)
    return NextResponse.json({ error: 'Kunne ikke slette' }, { status: 500 })
  }
}
