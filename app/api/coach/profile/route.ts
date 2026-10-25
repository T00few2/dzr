import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { hasClubMemberRole } from '@/app/lib/intervalsAuth'
import {
  COACH_PROFILES_COLLECTION,
  defaultCoachProfile,
  emptyCoachProfile,
  publicCoachFields,
  toClientCoachProfile,
} from '@/app/lib/coachProfile'
import { persistCoachMemoryDoc, unwrapCoachMemoryDoc, canEncryptCoachMemory, coachProfileStamps } from '@/app/lib/tokenCrypto'
import { ensureDefaultCoachProfile } from '@/app/lib/ensureCoachProfile'

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
    console.warn('COACH_MEMORY_KEY / COACH_CONNECT_SECRET missing; storing coach memory in plaintext')
  }
}

/** A skip or a finished setup is a one-way stamp. The client cannot clear it. */
function withOnboardingChoice(
  stamps: ReturnType<typeof coachProfileStamps>,
  body: { onboardingSkip?: unknown; onboardingFinish?: unknown }
) {
  const next = { ...stamps }
  const now = new Date().toISOString()
  const skip = String(body?.onboardingSkip || '')
  if (skip === 'notes') next.onboardingNotesSkippedAt = next.onboardingNotesSkippedAt || now
  if (skip === 'weekly') next.onboardingWeeklySkippedAt = next.onboardingWeeklySkippedAt || now
  if (skip === 'calendar') next.onboardingCalendarSkippedAt = next.onboardingCalendarSkippedAt || now
  if (body?.onboardingFinish === true) next.onboardingFinishedAt = next.onboardingFinishedAt || now
  return next
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

    const profile = await ensureDefaultCoachProfile(discordId)
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
    const ref = adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId)
    const now = new Date()
    warnIfPlaintext()

    // Read and write inside a transaction. The bot stamps lastAthleteMessageAt / lastFollowUpAt
    // on the same document, so an unguarded read-then-set here could carry a stale stamp back
    // and undo the bot's write (and vice versa). The transaction retries on contention.
    // onboardingOnly keeps the stored settings and only applies a skip or finished stamp, so
    // closing the wizard cannot overwrite a save the member just made in the form below.
    const written = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const current = unwrapCoachMemoryDoc({ ...(snap.exists ? snap.data() || {} : {}), discordId })
      const fields = body?.onboardingOnly === true ? publicCoachFields(current) : publicCoachFields(body)
      const stamps = withOnboardingChoice(coachProfileStamps(current), body)
      tx.set(
        ref,
        persistCoachMemoryDoc({
          discordId,
          ...fields,
          updatedAt: now,
          updatedBy: 'user',
          ...stamps,
        })
      )
      return { fields, stamps }
    })

    return NextResponse.json({
      ok: true,
      profile: toClientCoachProfile({
        ...written.fields,
        discordId,
        updatedAt: now,
        updatedBy: 'user',
        ...written.stamps,
      }, discordId),
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
    const weeklyIndexRaw = url.searchParams.get('weeklyIndex')
    const ref = adminDb.collection(COACH_PROFILES_COLLECTION).doc(discordId)
    const now = new Date()
    const isFullReset = !injuryId && (weeklyIndexRaw == null || weeklyIndexRaw === '')
    warnIfPlaintext()

    // Same transaction as PUT: the bot stamps lastAthleteMessageAt / lastFollowUpAt on this
    // document, so an unguarded read-then-set can silently undo the bot's write.
    const written = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const existing = unwrapCoachMemoryDoc({ ...(snap.exists ? snap.data() || {} : {}), discordId })

      let next: ReturnType<typeof publicCoachFields>
      if (isFullReset) {
        next = defaultCoachProfile()
      } else {
        next = publicCoachFields(existing)
        if (injuryId) {
          next.injuries = next.injuries.filter((inj) => inj.id !== injuryId)
        } else {
          const idx = Number(weeklyIndexRaw)
          if (Number.isInteger(idx) && idx >= 0 && idx < next.weekly.length) {
            next.weekly.splice(idx, 1)
          }
        }
      }

      const stamps = coachProfileStamps(existing)
      tx.set(
        ref,
        persistCoachMemoryDoc({
          discordId,
          ...next,
          updatedAt: now,
          updatedBy: 'user',
          ...stamps,
        })
      )
      return { next, stamps }
    })

    return NextResponse.json({
      ok: true,
      profile: toClientCoachProfile({
        ...written.next,
        discordId,
        updatedAt: now,
        updatedBy: 'user',
        ...written.stamps,
      }, discordId),
    })
  } catch (err: any) {
    console.error('coach profile DELETE failed:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
