import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { listGuildChannels, listGuildMembers } from '@/app/api/admin/_lib/discord'
import {
  SIGNUP_BOARDS_COLLECTION,
  boardOptions,
  signupCount,
} from '@/app/api/admin/_lib/signupBoards'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  const showAll = new URL(req.url).searchParams.get('all') === '1'
  const [boardsSnap, configsSnap, members, channels] = await Promise.all([
    adminDb.collection(SIGNUP_BOARDS_COLLECTION).limit(500).get(),
    adminDb.collection(COLLECTIONS.signupBoardConfigs).limit(500).get(),
    listGuildMembers(5000),
    listGuildChannels(),
  ])

  const nameById: Record<string, string> = {}
  for (const m of members) {
    const id = String(m.user?.id || '')
    if (!id) continue
    nameById[id] = m.nick || m.user?.global_name || m.user?.username || id
  }
  const channelById: Record<string, string> = {}
  for (const c of channels) channelById[String(c.id)] = c.name || String(c.id)

  const configs: Record<string, any> = {}
  configsSnap.docs.forEach((d) => { configs[d.id] = { id: d.id, ...d.data() } })

  let boards = boardsSnap.docs.map((d) => {
    const data = d.data() || {}
    const config = data.configId ? configs[String(data.configId)] || null : null
    const signups = data.signups || {}
    const options = boardOptions(config, signups).map((opt: any) => {
      const userIds = (signups[opt.value] || []).filter(Boolean).map(String)
      return {
        ...opt,
        userIds,
        riders: userIds.map((userId: string) => ({
          userId,
          displayName: nameById[userId] || userId,
        })),
      }
    })
    return {
      id: d.id,
      configId: data.configId || null,
      title: config?.title || 'Legacy ZRL board',
      channelId: data.channelId || null,
      channelName: channelById[String(data.channelId)] || data.channelId || 'unknown',
      messageId: data.messageId || null,
      createdAt: data.createdAt || 0,
      updatedAt: data.updatedAt || 0,
      total: signupCount(signups),
      options,
      isLatest: false,
    }
  })

  boards.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
  const seen = new Set<string>()
  for (const board of boards) {
    const key = `${board.channelId || ''}::${board.configId || 'legacy'}`
    if (!seen.has(key)) {
      board.isLatest = true
      seen.add(key)
    }
  }
  if (!showAll) boards = boards.filter((b) => b.isLatest)

  return NextResponse.json({ boards })
}
