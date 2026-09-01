import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { editChannelMessage } from '@/app/api/admin/_lib/discord'

export const SIGNUP_BOARDS_COLLECTION = 'signup_boards'

export const LEGACY_OPTIONS = [
  { emoji: '🇩', label: 'Division D', value: 'D' },
  { emoji: '🇨', label: 'Division C', value: 'C' },
  { emoji: '🇧', label: 'Division B', value: 'B' },
  { emoji: '🇦', label: 'Division A', value: 'A' },
]

export function boardOptions(config: any | null, signups: Record<string, any>) {
  if (config?.options?.length) return config.options
  const keys = Object.keys(signups || {})
  if (keys.length) {
    return keys.map((value) => {
      const legacy = LEGACY_OPTIONS.find((o) => o.value === value)
      return legacy || { emoji: '', label: value, value }
    })
  }
  return LEGACY_OPTIONS
}

export function signupCount(signups: Record<string, any> = {}) {
  return Object.values(signups).reduce((n: number, list: any) => n + (Array.isArray(list) ? list.filter(Boolean).length : 0), 0)
}

export function buildSignupEmbed(board: any, config: any | null) {
  const signups = board.signups || {}
  const options = boardOptions(config, signups)
  const title = config?.title || 'ZRL holdinteresser: A / B / C / D'
  const description = config?.description || (
    'Reager nedenfor hvis du er interesseret i at køre for et ZRL hold i din division.\n' +
    '🇩 = D • 🇨 = C • 🇧 = B • 🇦 = A\n' +
    'Fjern din reaktion hvis du ikke længere er interesseret.'
  )
  const fields = options.map((opt: any) => {
    const users = (signups[opt.value] || []).filter(Boolean)
    const mentionList = users.slice(0, 20).map((id: string) => `<@${id}>`).join('\n')
    const extra = users.length > 20 ? `\n+${users.length - 20} more` : ''
    const name = config
      ? `${opt.emoji || ''} ${opt.label} (${users.length})`.trim()
      : `Division ${opt.value} (${users.length})`
    return {
      name,
      value: users.length ? `${mentionList}${extra}` : '—',
      inline: Boolean(config),
    }
  })
  return {
    title,
    description,
    color: 0x5865f2,
    footer: { text: title },
    timestamp: new Date().toISOString(),
    fields,
  }
}

export async function loadSignupConfig(configId?: string | null) {
  if (!configId) return null
  const snap = await adminDb.collection(COLLECTIONS.signupBoardConfigs).doc(String(configId)).get()
  return snap.exists ? { id: snap.id, ...snap.data() } : null
}

export async function removeSignup(boardId: string, userId: string, optionValue?: string | null): Promise<
  | { error: string; status: number }
  | { board: any; config: any; discordUpdated: boolean; discordError: string | null }
> {
  const ref = adminDb.collection(SIGNUP_BOARDS_COLLECTION).doc(boardId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Board not found', status: 404 as const }

  const board = { id: snap.id, ...snap.data() } as any
  const signups = { ...(board.signups || {}) }
  const keys = optionValue ? [optionValue] : Object.keys(signups)
  let removed = false
  for (const key of keys) {
    const before = Array.isArray(signups[key]) ? signups[key] : []
    const next = before.filter((id: string) => String(id) !== String(userId))
    if (next.length !== before.length) removed = true
    signups[key] = next
  }
  if (!removed) return { error: 'Rider not found on this board', status: 404 as const }

  board.signups = signups
  board.updatedAt = Date.now()
  await ref.set({ signups, updatedAt: board.updatedAt }, { merge: true })

  const config = await loadSignupConfig(board.configId)
  let discordUpdated = false
  let discordError: string | null = null
  if (board.channelId && board.messageId) {
    const embed = buildSignupEmbed(board, config)
    const res = await editChannelMessage(board.channelId, board.messageId, { embeds: [embed] })
    discordUpdated = res.ok
    if (!res.ok) discordError = res.body?.message || `Discord ${res.status}`
  }

  return { board, config, discordUpdated, discordError }
}
