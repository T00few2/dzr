import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole } from '@/app/lib/stravaAuth'
import {
  COACH_PROFILES_COLLECTION,
  emptyCoachProfile,
  publicCoachFields,
  toClientCoachProfile,
} from '@/app/lib/coachProfile'
import {
  canEncryptCoachMemory,
  needsCoachMemoryMigration,
  persistCoachMemoryDoc,
  unwrapCoachMemoryDoc,
} from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function sessionMember(req: Request) {
  const session = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  const discordId = String((session as any)?.discordId || '').trim()
  if (!discordId) return { discordId: '', eligible: false }
  return { discordId, eligible: await hasClubMemberRole(discordId) }
}

function warnIfPlaintext() {
  if (!canEncryptCoachMemory()) {
    console.warn('COACH_MEMORY_KEY / STRAVA_CONNECT_SECRET missing; storing coach memory in plaintext')
  }
}

export async function GET(req: Request) {
  try {
    const { discordId, eligible } = await sessionMember(req)
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    if (!eligible) {
      return NextResponse.json({ eligible: false, profile: emptyCoachProfile() })
    }

    const ref = adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId)
    const snap = await ref.get()
    const raw = snap.exists ? { ...(snap.data() || {}), discordId } : null
    if (raw && needsCoachMemoryMigration(raw)) {
      try {
        const unwrapped = unwrapCoachMemoryDoc(raw)
        await ref.set(
          persistCoachMemoryDoc({
            discordId,
            updatedAt: unwrapped.updatedAt ?? null,
            updatedBy: unwrapped.updatedBy ?? null,
            ...publicCoachFields(unwrapped, unwrapped.updatedBy === 'coach' ? 'coach' : 'user'),
            pendingConfirmation: unwrapped.pendingConfirmation ?? null,
          })
        )
      } catch (err: any) {
        console.warn('coach memory encryption migrate failed:', err?.message || err)
      }
    }
    const profile = raw
      ? toClientCoachProfile(raw, discordId)
      : { ...emptyCoachProfile(), discordId, updatedAt: null, updatedBy: null }

    return NextResponse.json({ eligible: true, profile })
  } catch (err: any) {
    console.error('coach profile GET failed:', err)
    return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const { discordId, eligible } = await sessionMember(req)
    if (!discordId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }
    if (!eligible) {
      return NextResponse.json({ error: 'Club membership required' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const fields = publicCoachFields(body, 'user')
    const now = new Date()
    warnIfPlaintext()
    await adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId).set(
      persistCoachMemoryDoc({
        discordId,
        ...fields,
        pendingConfirmation: null,
        updatedAt: now,
        updatedBy: 'user',
      })
    )

    return NextResponse.json({
      ok: true,
      profile: toClientCoachProfile({ ...fields, discordId, updatedAt: now, updatedBy: 'user' }, discordId),
    })
  } catch (err: any) {
    console.error('coach profile PUT failed:', err)
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
    const injuryId = String(url.searchParams.get('injuryId') || '').trim()
    const goalIndexRaw = url.searchParams.get('goalIndex')
    const weeklyIndexRaw = url.searchParams.get('weeklyIndex')
    const clearNotes = url.searchParams.get('notes') === '1'
    const ref = adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId)
    const snap = await ref.get()
    const existing = unwrapCoachMemoryDoc({ ...(snap.exists ? snap.data() || {} : {}), discordId })
    const current = publicCoachFields(existing, existing.updatedBy === 'coach' ? 'coach' : 'user')
    const now = new Date()

    if (injuryId) {
      current.injuries = current.injuries.filter((inj) => inj.id !== injuryId)
    } else if (goalIndexRaw != null && goalIndexRaw !== '') {
      const idx = Number(goalIndexRaw)
      if (Number.isInteger(idx) && idx >= 0 && idx < current.goals.length) {
        current.goals.splice(idx, 1)
      }
    } else if (weeklyIndexRaw != null && weeklyIndexRaw !== '') {
      const idx = Number(weeklyIndexRaw)
      if (Number.isInteger(idx) && idx >= 0 && idx < current.weekly.length) {
        current.weekly.splice(idx, 1)
      }
    } else if (clearNotes) {
      current.notes = ''
    } else {
      await ref.delete()
      return NextResponse.json({
        ok: true,
        profile: { ...emptyCoachProfile(), discordId, updatedAt: null, updatedBy: null },
      })
    }

    warnIfPlaintext()
    await ref.set(
      persistCoachMemoryDoc({
        discordId,
        ...current,
        pendingConfirmation: null,
        updatedAt: now,
        updatedBy: 'user',
      })
    )

    return NextResponse.json({
      ok: true,
      profile: toClientCoachProfile({ ...current, discordId, updatedAt: now, updatedBy: 'user' }, discordId),
    })
  } catch (err: any) {
    console.error('coach profile DELETE failed:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
