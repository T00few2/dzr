import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { discordGet, guildId } from '@/app/api/admin/_lib/discord'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'

type ActivityDoc = {
  dateKey?: string
  timestamp?: string
  totalActivities?: number
  rawData?: {
    messageCount?: number
    reactionCount?: number
    voiceActivityCount?: number
    interactionCount?: number
  }
  summary?: {
    userActivity?: Record<string, {
      username?: string
      messages?: number
      reactions?: number
      voiceActivity?: number
      interactions?: number
    }>
    channelActivity?: Record<string, {
      channelName?: string
      messages?: number
      reactions?: number
    }>
  }
}

type DailyRow = {
  date: string
  messages: number
  reactions: number
  voice: number
  interactions: number
  total: number
}

const ALLOWED_DAYS = new Set([7, 30, 90])

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function berlinDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function nextUtcDateKey(day: string): string {
  const dt = new Date(`${day}T00:00:00.000Z`)
  dt.setUTCDate(dt.getUTCDate() + 1)
  return utcDateKey(dt)
}

function eachDayInclusive(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = nextUtcDateKey(day)) days.push(day)
  return days
}

function n(value: unknown): number {
  const x = Number(value)
  return Number.isFinite(x) ? x : 0
}

async function loadActivities(startKey: string, endKey: string): Promise<ActivityDoc[]> {
  const col = adminDb.collection(COLLECTIONS.serverActivity)
  try {
    const snap = await col
      .where('dateKey', '>=', startKey)
      .where('dateKey', '<=', endKey)
      .get()
    return snap.docs.map((d) => d.data() as ActivityDoc)
  } catch {
    try {
      const startIso = `${startKey}T00:00:00.000Z`
      const endIso = `${endKey}T23:59:59.999Z`
      const snap = await col
        .where('timestamp', '>=', startIso)
        .where('timestamp', '<=', endIso)
        .get()
      return snap.docs.map((d) => d.data() as ActivityDoc)
    } catch {
      const snap = await col.limit(5000).get()
      return snap.docs
        .map((d) => d.data() as ActivityDoc)
        .filter((a) => {
          const key = a.dateKey || String(a.timestamp || '').slice(0, 10)
          return key >= startKey && key <= endKey
        })
    }
  }
}

async function snapshotTodayMemberCount() {
  try {
    const { ok, body } = await discordGet(`/guilds/${guildId()}?with_counts=true`)
    if (!ok) return
    const memberCount = body?.approximate_member_count
    const presenceCount = body?.approximate_presence_count
    if (typeof memberCount !== 'number') return
    const dateKey = berlinDateKey()
    const snapshot: Record<string, unknown> = {
      dateKey,
      timestamp: new Date().toISOString(),
      memberCount,
    }
    if (typeof presenceCount === 'number') snapshot.presenceCount = presenceCount
    await adminDb.collection(COLLECTIONS.serverMemberCounts).doc(dateKey).set(snapshot, { merge: true })
  } catch {
    // Keep serving historical snapshots if Discord is unavailable.
  }
}

async function loadMemberCounts() {
  try {
    const snap = await adminDb.collection(COLLECTIONS.serverMemberCounts).orderBy('dateKey').get().catch(async () => {
      return adminDb.collection(COLLECTIONS.serverMemberCounts).get()
    })
    const series = snap.docs
      .map((d) => {
        const data = d.data() as {
          dateKey?: string
          memberCount?: number
          presenceCount?: number
          estimated?: boolean
        }
        const date = data.dateKey || d.id
        const members = n(data.memberCount)
        if (!date || !Number.isFinite(members) || members < 0) return null
        return {
          date,
          members,
          presence: typeof data.presenceCount === 'number' ? data.presenceCount : null,
          estimated: Boolean(data.estimated),
        }
      })
      .filter((row): row is { date: string; members: number; presence: number | null; estimated: boolean } => Boolean(row))
      .sort((a, b) => a.date.localeCompare(b.date))
    const latest = series.length ? series[series.length - 1] : null
    return { series, latest }
  } catch {
    return { series: [] as { date: string; members: number; presence: number | null; estimated: boolean }[], latest: null }
  }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  const url = new URL(req.url)
  const requested = Number(url.searchParams.get('days') || 30)
  const days = ALLOWED_DAYS.has(requested) ? requested : 30

  const end = new Date()
  const endKey = utcDateKey(end)
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  const startKey = utcDateKey(start)

  const [activities, memberCounts] = await Promise.all([
    loadActivities(startKey, endKey),
    snapshotTodayMemberCount().then(() => loadMemberCounts()),
  ])

  const byDay: Record<string, DailyRow> = {}
  for (const day of eachDayInclusive(startKey, endKey)) {
    byDay[day] = { date: day, messages: 0, reactions: 0, voice: 0, interactions: 0, total: 0 }
  }

  const users = new Set<string>()
  const channels = new Set<string>()
  const userTotals: Record<string, {
    user_id: string
    username: string
    messages: number
    reactions: number
    voice: number
    interactions: number
    total: number
  }> = {}
  const channelTotals: Record<string, {
    channel_id: string
    channel_name: string
    messages: number
    reactions: number
    total: number
  }> = {}

  for (const activity of activities) {
    const date = activity.dateKey || String(activity.timestamp || '').slice(0, 10)
    if (!date || !byDay[date]) continue
    const messages = n(activity.rawData?.messageCount)
    const reactions = n(activity.rawData?.reactionCount)
    const voice = n(activity.rawData?.voiceActivityCount)
    const interactions = n(activity.rawData?.interactionCount)
    byDay[date].messages += messages
    byDay[date].reactions += reactions
    byDay[date].voice += voice
    byDay[date].interactions += interactions
    byDay[date].total += n(activity.totalActivities) || messages + reactions + voice + interactions

    const userActivity = activity.summary?.userActivity || {}
    for (const [userId, user] of Object.entries(userActivity)) {
      users.add(userId)
      if (!userTotals[userId]) {
        userTotals[userId] = {
          user_id: userId,
          username: user?.username || 'Unknown',
          messages: 0,
          reactions: 0,
          voice: 0,
          interactions: 0,
          total: 0,
        }
      }
      const row = userTotals[userId]
      if (user?.username && row.username === 'Unknown') row.username = user.username
      row.messages += n(user?.messages)
      row.reactions += n(user?.reactions)
      row.voice += n(user?.voiceActivity)
      row.interactions += n(user?.interactions)
      row.total = row.messages + row.reactions + row.voice + row.interactions
    }

    const channelActivity = activity.summary?.channelActivity || {}
    for (const [channelId, channel] of Object.entries(channelActivity)) {
      channels.add(channelId)
      if (!channelTotals[channelId]) {
        channelTotals[channelId] = {
          channel_id: channelId,
          channel_name: channel?.channelName || 'Unknown',
          messages: 0,
          reactions: 0,
          total: 0,
        }
      }
      const row = channelTotals[channelId]
      if (channel?.channelName && row.channel_name === 'Unknown') row.channel_name = channel.channelName
      row.messages += n(channel?.messages)
      row.reactions += n(channel?.reactions)
      row.total = row.messages + row.reactions
    }
  }

  const daily = eachDayInclusive(startKey, endKey).map((day) => byDay[day])
  const totalMessages = daily.reduce((s, d) => s + d.messages, 0)
  const totalReactions = daily.reduce((s, d) => s + d.reactions, 0)
  const totalVoice = daily.reduce((s, d) => s + d.voice, 0)
  const totalInteractions = daily.reduce((s, d) => s + d.interactions, 0)
  const daysWithActivity = daily.filter((d) => d.total > 0).length

  const topUsers = Object.values(userTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  const topChannels = Object.values(channelTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return NextResponse.json({
    period: { days, start: startKey, end: endKey },
    totals: {
      messages: totalMessages,
      reactions: totalReactions,
      voice: totalVoice,
      interactions: totalInteractions,
      uniqueUsers: users.size,
      uniqueChannels: channels.size,
      daysWithActivity,
      avgDailyMessages: Math.round((totalMessages / Math.max(daysWithActivity, 1)) * 10) / 10,
    },
    daily,
    topUsers,
    topChannels,
    members: memberCounts,
  })
}
