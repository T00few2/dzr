import {
  ADMIN_ROLE_ID,
  COMMUNITY_MEMBER_ROLE_ID,
  DISCORD_GUILD_ID_DEFAULT,
  HOLDKAPTAJN_ROLE_ID,
  KMS_ROLE_ID,
  VERIFIED_MEMBER_ROLE_ID,
} from '@/app/lib/sharedConstants'

export function guildId() {
  return process.env.DISCORD_GUILD_ID || DISCORD_GUILD_ID_DEFAULT
}

export const ChannelType = {
  GuildText: 0,
  GuildVoice: 2,
  GuildCategory: 4,
} as const

export const OverwriteType = {
  Role: 0,
  Member: 1,
} as const

export const PermissionFlags = {
  ManageChannels: 1n << 4n,
  AddReactions: 1n << 6n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
} as const

export function permissionBits(...flags: bigint[]) {
  return flags.reduce((a, b) => a | b, 0n).toString()
}

export function protectedRoleIds() {
  return new Set([
    guildId(),
    ADMIN_ROLE_ID,
    VERIFIED_MEMBER_ROLE_ID,
    COMMUNITY_MEMBER_ROLE_ID,
    HOLDKAPTAJN_ROLE_ID,
    KMS_ROLE_ID,
  ])
}

export function defaultExtraViewerRoleIds() {
  return [] as string[]
}

export function discordErrorMessage(res: { ok: boolean; status: number; body: any }, fallback: string) {
  if (res.ok) return null
  const code = res.body?.code
  const msg = res.body?.message || (typeof res.body === 'string' && res.body ? res.body : null)
  if (code === 50013 || /missing permissions/i.test(String(msg || ''))) {
    return `${fallback}: Discord missing access on the target category. Open that category's permissions and allow DZR Bot View Channel + Manage Channels (do not sync from a locked parent).`
  }
  return msg ? `${fallback}: ${msg}` : `${fallback} (${res.status})`
}

export function slugifyChannelName(name: string) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return slug || 'channel'
}

export function botHeaders(withJson = true) {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set')
  const headers: Record<string, string> = {
    Authorization: `Bot ${token}`,
  }
  if (withJson) headers['Content-Type'] = 'application/json'
  return headers
}

export async function discordGet(path: string) {
  return discordRequest(path)
}

export async function discordRequest(path: string, init?: { method?: string; body?: any }) {
  const hasBody = init?.body !== undefined
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: init?.method || 'GET',
    headers: botHeaders(hasBody),
    cache: 'no-store',
    body: hasBody ? JSON.stringify(init.body) : undefined,
  })
  const text = await res.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body }
}

export async function editChannelMessage(channelId: string, messageId: string, payload: any) {
  return discordRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteChannelMessage(channelId: string, messageId: string) {
  return discordRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
  })
}

export async function listGuildMembers(max = 4000) {
  const members: any[] = []
  let after = '0'
  while (members.length < max) {
    const limit = Math.min(1000, max - members.length)
    const { ok, body } = await discordGet(`/guilds/${guildId()}/members?limit=${limit}&after=${after}`)
    if (!ok || !Array.isArray(body) || body.length === 0) break
    members.push(...body)
    after = body[body.length - 1]?.user?.id
    if (!after || body.length < limit) break
  }
  return members
}

export async function listAllGuildRoles() {
  const { ok, body } = await discordGet(`/guilds/${guildId()}/roles`)
  if (!ok || !Array.isArray(body)) return []
  return body
}

export async function listGuildRoles() {
  return (await listAllGuildRoles()).filter((r: any) => r?.name !== '@everyone' && !r?.managed)
}

export async function listGuildChannels() {
  const { ok, body } = await discordGet(`/guilds/${guildId()}/channels`)
  if (!ok || !Array.isArray(body)) return []
  return body
}

export async function getBotUser() {
  const { ok, body } = await discordGet('/users/@me')
  if (!ok || !body?.id) throw new Error(discordErrorMessage({ ok, status: 0, body }, 'Failed to identify bot user') || 'Failed to identify bot user')
  return body as { id: string; username?: string }
}

export async function getBotMember() {
  const bot = await getBotUser()
  const { ok, body } = await discordGet(`/guilds/${guildId()}/members/${bot.id}`)
  if (!ok || !body) throw new Error(discordErrorMessage({ ok, status: 0, body }, 'Failed to load bot guild member') || 'Failed to load bot guild member')
  return { userId: String(bot.id), roleIds: Array.isArray(body.roles) ? body.roles.map(String) : [] }
}

export type PermissionOverwrite = {
  id: string
  type: number
  allow?: string
  deny?: string
}

export function findBotRoleId(guildRoles: any[], botUserId: string) {
  const tagged = guildRoles.find((r: any) => String(r?.tags?.bot_id || '') === String(botUserId))
  if (tagged?.id) return String(tagged.id)
  const clientId = process.env.DISCORD_CLIENT_ID
  if (clientId && guildRoles.some((r: any) => String(r.id) === clientId)) return clientId
  return null
}

function completeOverwrite(overwrite: PermissionOverwrite): PermissionOverwrite {
  return {
    id: String(overwrite.id),
    type: overwrite.type,
    allow: overwrite.allow || '0',
    deny: overwrite.deny || '0',
  }
}

export function privateChannelOverwrites(opts: {
  roleId: string
  botRoleId?: string | null
  voice?: boolean
}): PermissionOverwrite[] {
  const view = PermissionFlags.ViewChannel
  const connect = PermissionFlags.Connect
  const everyoneDeny = opts.voice ? permissionBits(view, connect) : permissionBits(view)
  const memberAllow = opts.voice ? permissionBits(view, connect, PermissionFlags.Speak) : permissionBits(view)
  const botAllow = opts.voice
    ? permissionBits(view, connect, PermissionFlags.Speak, PermissionFlags.ManageChannels)
    : permissionBits(view, PermissionFlags.ManageChannels)

  const overwrites: PermissionOverwrite[] = [
    { id: guildId(), type: OverwriteType.Role, allow: '0', deny: everyoneDeny },
    { id: opts.roleId, type: OverwriteType.Role, allow: memberAllow, deny: '0' },
    { id: ADMIN_ROLE_ID, type: OverwriteType.Role, allow: memberAllow, deny: '0' },
  ]
  if (opts.botRoleId) {
    overwrites.push({ id: opts.botRoleId, type: OverwriteType.Role, allow: botAllow, deny: '0' })
  }
  return overwrites.map(completeOverwrite)
}

export async function replaceChannelOverwrites(channelId: string, overwrites: PermissionOverwrite[]) {
  const { ok, status, body } = await discordRequest(`/channels/${channelId}`, {
    method: 'PATCH',
    body: { permission_overwrites: overwrites },
  })
  if (ok) return
  throw new Error(discordErrorMessage({ ok, status, body }, 'Failed to set channel permissions') || 'Failed to set channel permissions')
}

export async function createGuildChannel(opts: {
  name: string
  type: number
  parentId?: string | null
  permissionOverwrites?: PermissionOverwrite[]
}) {
  const attempt = async (body: Record<string, unknown>) => {
    const { ok, status, body: resBody } = await discordRequest(`/guilds/${guildId()}/channels`, {
      method: 'POST',
      body,
    })
    return { ok, status, body: resBody }
  }

  const base: Record<string, unknown> = {
    name: opts.name,
    type: opts.type,
  }
  if (opts.parentId) base.parent_id = opts.parentId

  if (opts.permissionOverwrites?.length) {
    const full = opts.permissionOverwrites.map(completeOverwrite)
    const withoutAdmin = full.filter((overwrite) => overwrite.id !== ADMIN_ROLE_ID)
    let last = await attempt({ ...base, permission_overwrites: withoutAdmin })
    if (last.ok && last.body?.id) {
      return last.body as { id: string; name: string; type: number }
    }
    last = await attempt({ ...base, permission_overwrites: full })
    if (last.ok && last.body?.id) {
      return last.body as { id: string; name: string; type: number }
    }
    throw new Error(
      discordErrorMessage(last, 'Failed to create Discord channel') || 'Failed to create Discord channel'
    )
  }

  const created = await attempt(base)
  if (!created.ok || !created.body?.id) {
    throw new Error(discordErrorMessage(created, 'Failed to create Discord channel') || 'Failed to create Discord channel')
  }
  return created.body as { id: string; name: string; type: number }
}

export async function putChannelOverwrite(channelId: string, overwrite: PermissionOverwrite) {
  const payload = completeOverwrite(overwrite)
  return discordRequest(`/channels/${channelId}/permissions/${payload.id}`, {
    method: 'PUT',
    body: {
      type: payload.type,
      allow: payload.allow,
      deny: payload.deny,
    },
  })
}

export async function applyChannelOverwrite(
  channelId: string,
  overwrite: PermissionOverwrite,
  opts?: { optional?: boolean }
) {
  const res = await putChannelOverwrite(channelId, overwrite)
  if (res.ok) return
  if (opts?.optional) return
  throw new Error(
    discordErrorMessage({ ok: res.ok, status: res.status, body: res.body }, 'Failed to set channel permission')
    || 'Failed to set channel permission'
  )
}

export async function deleteChannelOverwrite(channelId: string, overwriteId: string) {
  const { ok, status, body } = await discordRequest(`/channels/${channelId}/permissions/${overwriteId}`, {
    method: 'DELETE',
  })
  if (ok || status === 404) return
  throw new Error(discordErrorMessage({ ok, status, body }, 'Failed to remove channel permission') || 'Failed to remove channel permission')
}

export async function getChannel(channelId: string) {
  const { ok, body } = await discordGet(`/channels/${channelId}`)
  if (!ok || !body?.id) return null
  return body as { id: string; permission_overwrites?: PermissionOverwrite[] }
}

export async function createGuildRole(opts: { name: string; color?: number }) {
  const { ok, status, body } = await discordRequest(`/guilds/${guildId()}/roles`, {
    method: 'POST',
    body: {
      name: opts.name,
      mentionable: true,
      hoist: false,
      permissions: '0',
      ...(typeof opts.color === 'number' && opts.color > 0 ? { color: opts.color } : {}),
    },
  })
  if (!ok || !body?.id) throw new Error(discordErrorMessage({ ok, status, body }, 'Failed to create Discord role') || 'Failed to create Discord role')
  return body as { id: string; name: string; color?: number; position?: number }
}


export async function deleteGuildRole(roleId: string) {
  const { ok, status, body } = await discordRequest(`/guilds/${guildId()}/roles/${roleId}`, { method: 'DELETE' })
  if (ok || status === 404) return
  throw new Error(discordErrorMessage({ ok, status, body }, 'Failed to delete Discord role') || 'Failed to delete Discord role')
}

export async function deleteGuildChannel(channelId: string) {
  const { ok, status, body } = await discordRequest(`/channels/${channelId}`, { method: 'DELETE' })
  if (ok || status === 404) return
  throw new Error(discordErrorMessage({ ok, status, body }, 'Failed to delete Discord channel') || 'Failed to delete Discord channel')
}

export async function sendChannelMessage(channelId: string, payload: any) {
  return discordRequest(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: payload,
  })
}

export async function sendDm(userId: string, content: string) {
  const ch = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify({ recipient_id: userId }),
  })
  if (!ch.ok) return false
  const channel = await ch.json()
  const msg = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify({ content }),
  })
  return msg.ok
}
