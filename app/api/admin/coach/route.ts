import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/stravaAuth'
import { hasStravaRefreshToken, unwrapCoachMemoryDoc } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function tsToIso(value: unknown): string | null {
  return toIso(value)
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  // The three coach collections are inherently small (one document per athlete who has opened
  // Coach). `users` is not - it holds every member - and it was previously scanned in full on
  // every dashboard load just to map ids to names. Fetch only the ids actually referenced,
  // after the small scans have told us which those are.
  const [connectionsSnap, usageSnap, profilesSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.stravaConnections).get(),
    adminDb.collection(COLLECTIONS.coachUsage).get(),
    adminDb.collection(COLLECTIONS.coachProfiles).get(),
  ])

  const connectionsById = new Map<string, any>()
  connectionsSnap.forEach((doc) => {
    connectionsById.set(doc.id, doc.data() || {})
  })

  const usageById = new Map<string, any>()
  usageSnap.forEach((doc) => {
    usageById.set(doc.id, { id: doc.id, ...(doc.data() || {}) })
  })

  const notesOptInById = new Map<string, boolean>()
  const followUpEveryDaysById = new Map<string, 3 | 7 | 14 | null>()
  // Decrypt failures must not take the dashboard down: unwrapCoachMemoryDoc throws on a missing
  // or mismatched key, and one bad document previously 500'd the whole page. Counting them here
  // doubles as key-drift detection — if Vercel and Render ever encrypt under different keys,
  // this number goes up and an admin sees it.
  const undecryptable: string[] = []
  profilesSnap.forEach((doc) => {
    try {
      const profile = unwrapCoachMemoryDoc({ ...(doc.data() || {}), discordId: doc.id })
      const days = Number(profile.followUpEveryDays)
      notesOptInById.set(doc.id, profile.notesOptIn === true)
      followUpEveryDaysById.set(doc.id, days === 3 || days === 7 || days === 14 ? days : null)
    } catch (err) {
      console.error('admin/coach: could not decrypt coach profile', doc.id, err)
      undecryptable.push(doc.id)
      notesOptInById.set(doc.id, false)
      followUpEveryDaysById.set(doc.id, null)
    }
  })

  const ids = new Set<string>([
    ...connectionsById.keys(),
    ...usageById.keys(),
    ...notesOptInById.keys(),
    ...followUpEveryDaysById.keys(),
  ])

  const usersById = new Map<string, any>()
  const idList = Array.from(ids)
  if (idList.length > 0) {
    // getAll() takes document refs directly, so this is one round trip for the ids we need
    // rather than a full-collection scan. Chunked to stay well inside Firestore's limits.
    const CHUNK = 300
    for (let i = 0; i < idList.length; i += CHUNK) {
      const refs = idList.slice(i, i + CHUNK).map((id) => adminDb.collection(COLLECTIONS.users).doc(id))
      const docs = await adminDb.getAll(...refs)
      docs.forEach((doc) => {
        if (doc.exists) usersById.set(doc.id, doc.data() || {})
      })
    }
  }

  const people = Array.from(ids).map((discordId) => {
    const conn = connectionsById.get(discordId) || null
    const usage = usageById.get(discordId) || null
    const user = usersById.get(discordId) || {}
    const first = String(conn?.athleteFirstname || '').trim()
    const last = String(conn?.athleteLastname || '').trim()
    const athleteName = [first, last].filter(Boolean).join(' ') || null
    return {
      discordId,
      username: usage?.username || user.username || null,
      athleteName,
      athleteId: conn?.athleteId ?? null,
      connected: hasStravaRefreshToken(conn),
      connectedAt: tsToIso(conn?.connectedAt),
      notesOptIn: notesOptInById.get(discordId) === true,
      followUpEveryDays: followUpEveryDaysById.get(discordId) ?? null,
      messageCount: Number(usage?.messageCount || 0),
      openaiCalls: Number(usage?.openaiCalls || 0),
      promptTokens: Number(usage?.promptTokens || 0),
      completionTokens: Number(usage?.completionTokens || 0),
      totalTokens: Number(usage?.totalTokens || 0),
      lastModel: usage?.lastModel || null,
      firstUsedAt: tsToIso(usage?.firstUsedAt),
      lastUsedAt: tsToIso(usage?.lastUsedAt),
    }
  })

  people.sort((a, b) => b.totalTokens - a.totalTokens || String(b.connectedAt || '').localeCompare(String(a.connectedAt || '')))

  let events: any[] = []
  try {
    const eventsSnap = await adminDb
      .collection(COLLECTIONS.coachUsageEvents)
      .orderBy('at', 'desc')
      .limit(50)
      .get()
    events = eventsSnap.docs.map((d) => {
      const data = d.data() || {}
      return {
        id: d.id,
        discordId: data.discordId || null,
        username: data.username || null,
        model: data.model || null,
        promptTokens: Number(data.promptTokens || 0),
        completionTokens: Number(data.completionTokens || 0),
        totalTokens: Number(data.totalTokens || 0),
        openaiCalls: Number(data.openaiCalls || 0),
        at: tsToIso(data.at),
      }
    })
  } catch {
    const fallback = await adminDb.collection(COLLECTIONS.coachUsageEvents).limit(50).get()
    events = fallback.docs
      .map((d) => {
        const data = d.data() || {}
        return {
          id: d.id,
          discordId: data.discordId || null,
          username: data.username || null,
          model: data.model || null,
          promptTokens: Number(data.promptTokens || 0),
          completionTokens: Number(data.completionTokens || 0),
          totalTokens: Number(data.totalTokens || 0),
          openaiCalls: Number(data.openaiCalls || 0),
          at: tsToIso(data.at),
        }
      })
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  }

  const totals = people.reduce(
    (acc, p) => {
      acc.connected += p.connected ? 1 : 0
      acc.notesOn += p.notesOptIn ? 1 : 0
      acc.checkInOn += p.followUpEveryDays ? 1 : 0
      acc.messageCount += p.messageCount
      acc.openaiCalls += p.openaiCalls
      acc.promptTokens += p.promptTokens
      acc.completionTokens += p.completionTokens
      acc.totalTokens += p.totalTokens
      return acc
    },
    { connected: 0, notesOn: 0, checkInOn: 0, messageCount: 0, openaiCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  )

  return NextResponse.json({
    totals: { ...totals, people: people.length },
    people,
    events,
    // Key-drift signal. Should always be 0. A non-zero count means some coach_profiles documents
    // cannot be decrypted with the key this runtime holds — most likely Vercel and Render have
    // drifted apart, or COACH_MEMORY_KEY was rotated (there is no keyId yet to tell those apart).
    undecryptableProfiles: undecryptable.length,
  })
}
