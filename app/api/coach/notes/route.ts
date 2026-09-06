import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole } from '@/app/lib/stravaAuth'
import {
  COACH_CHAT_NOTES_COLLECTION,
  COACH_CHAT_NOTES_SUBCOLLECTION,
  MAX_ACTIVE_GOALS,
  activeGoalNotes,
  sanitizeGoalEventDate,
  toClientCoachChatNote,
  MAX_NOTES_PER_ATHLETE,
} from '@/app/lib/coachChatNotes'
import { COACH_PROFILES_COLLECTION } from '@/app/lib/coachProfile'
import { canEncryptCoachMemory, persistChatNoteDoc, unwrapCoachMemoryDoc } from '@/app/lib/tokenCrypto'
import { deleteAllCoachChatNotes } from '@/app/lib/clearCoachData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function sessionMember(req: Request) {
  const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  const discordId = String((session as any)?.discordId || '').trim()
  if (!discordId) return { discordId: '', eligible: false }
  return { discordId, eligible: await hasClubMemberRole(discordId) }
}

function notesCol(discordId: string) {
  return adminDb.collection(COACH_CHAT_NOTES_COLLECTION).doc(discordId).collection(COACH_CHAT_NOTES_SUBCOLLECTION)
}

async function listNotes(discordId: string) {
  const snap = await notesCol(discordId).orderBy('at', 'desc').limit(200).get()
  return snap.docs
    .map((doc) => toClientCoachChatNote({ ...(doc.data() || {}), id: doc.id }, doc.id))
    .filter((note): note is NonNullable<typeof note> => Boolean(note))
}

export async function GET(req: Request) {
  try {
    const { discordId, eligible } = await sessionMember(req)
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    if (!eligible) {
      return NextResponse.json({ eligible: false, notes: [] })
    }
    if (!canEncryptCoachMemory()) {
      console.warn('COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; reading coach chat notes without dedicated key')
    }
    const notes = await listNotes(discordId)
    return NextResponse.json({ eligible: true, notes })
  } catch (err: any) {
    console.error('coach notes GET failed:', err)
    return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { discordId, eligible } = await sessionMember(req)
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    if (!eligible) {
      return NextResponse.json({ error: 'Club membership required' }, { status: 403 })
    }

    const profileSnap = await adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId).get()
    const profile = unwrapCoachMemoryDoc({ ...(profileSnap.data() || {}), discordId })
    if (profile.notesOptIn !== true) {
      return NextResponse.json({ error: 'Chat-noter skal være slået til' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const text = String(body?.text || '').trim().slice(0, 280)
    const eventDate = sanitizeGoalEventDate(body?.eventDate)
    if (!text) {
      return NextResponse.json({ error: 'Skriv et mål' }, { status: 400 })
    }
    if (!eventDate) {
      return NextResponse.json({ error: 'Vælg en dato i fremtiden' }, { status: 400 })
    }

    const existing = await listNotes(discordId)
    if (activeGoalNotes(existing).length >= MAX_ACTIVE_GOALS) {
      return NextResponse.json({ error: `Højst ${MAX_ACTIVE_GOALS} aktive mål` }, { status: 400 })
    }
    // The bot prunes to MAX_NOTES_PER_ATHLETE; this path had no cap at all, so notes could grow
    // past the 200 that listNotes() reads back — at which point older goals silently drop out of
    // the coach prompt while still existing in Firestore.
    if (existing.length >= MAX_NOTES_PER_ATHLETE) {
      return NextResponse.json(
        { error: `Du har nået grænsen på ${MAX_NOTES_PER_ATHLETE} noter. Slet nogle først.` },
        { status: 400 }
      )
    }

    if (!canEncryptCoachMemory()) {
      console.warn('COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach chat notes in plaintext')
    }

    const now = new Date()
    const ref = notesCol(discordId).doc()
    await adminDb.collection(COACH_CHAT_NOTES_COLLECTION).doc(discordId).set({
      discordId,
      updatedAt: now,
    }, { merge: true })
    await ref.set(persistChatNoteDoc({
      discordId,
      at: now,
      text,
      kind: 'goal',
      eventDate,
    }))

    return NextResponse.json({ ok: true, notes: await listNotes(discordId) })
  } catch (err: any) {
    console.error('coach notes POST failed:', err)
    return NextResponse.json({ error: err?.message || 'Save failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { discordId, eligible } = await sessionMember(req)
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    if (!eligible) {
      return NextResponse.json({ error: 'Club membership required' }, { status: 403 })
    }

    const url = new URL(req.url)
    const noteId = String(url.searchParams.get('id') || '').trim()
    const deleteAll = url.searchParams.get('all') === '1'
    const col = notesCol(discordId)

    if (noteId) {
      await col.doc(noteId).delete()
      return NextResponse.json({ ok: true, notes: await listNotes(discordId) })
    }

    if (!deleteAll) {
      return NextResponse.json({ error: 'Specify id or all=1' }, { status: 400 })
    }

    await deleteAllCoachChatNotes(discordId)

    return NextResponse.json({ ok: true, notes: [] })
  } catch (err: any) {
    console.error('coach notes DELETE failed:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
