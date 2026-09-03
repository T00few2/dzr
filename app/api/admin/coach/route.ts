import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { toIso } from '@/app/lib/stravaAuth'
import { hasStravaRefreshToken } from '@/app/lib/tokenCrypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function tsToIso(value: unknown): string | null {
  return toIso(value)
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  const [connectionsSnap, usageSnap, usersSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.stravaConnections).get(),
    adminDb.collection(COLLECTIONS.coachUsage).get(),
    adminDb.collection(COLLECTIONS.users).get(),
  ])

  const usersById = new Map<string, any>()
  usersSnap.forEach((doc) => {
    usersById.set(doc.id, doc.data() || {})
  })

  const connectionsById = new Map<string, any>()
  connectionsSnap.forEach((doc) => {
    connectionsById.set(doc.id, doc.data() || {})
  })

  const usageById = new Map<string, any>()
  usageSnap.forEach((doc) => {
    usageById.set(doc.id, { id: doc.id, ...(doc.data() || {}) })
  })

  const ids = new Set<string>([...connectionsById.keys(), ...usageById.keys()])

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
      acc.messageCount += p.messageCount
      acc.openaiCalls += p.openaiCalls
      acc.promptTokens += p.promptTokens
      acc.completionTokens += p.completionTokens
      acc.totalTokens += p.totalTokens
      return acc
    },
    { connected: 0, messageCount: 0, openaiCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  )

  return NextResponse.json({
    totals: { ...totals, people: people.length },
    people,
    events,
  })
}
