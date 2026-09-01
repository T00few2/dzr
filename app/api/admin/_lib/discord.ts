import { DISCORD_GUILD_ID_DEFAULT } from '@/app/lib/sharedConstants'

export function guildId() {
  return process.env.DISCORD_GUILD_ID || DISCORD_GUILD_ID_DEFAULT
}

export function botHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set')
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function discordGet(path: string) {
  return discordRequest(path)
}

export async function discordRequest(path: string, init?: { method?: string; body?: any }) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: init?.method || 'GET',
    headers: botHeaders(),
    cache: 'no-store',
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
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

export async function listGuildRoles() {
  const { ok, body } = await discordGet(`/guilds/${guildId()}/roles`)
  if (!ok || !Array.isArray(body)) return []
  return body.filter((r: any) => r?.name !== '@everyone' && !r?.managed)
}

export async function listGuildChannels() {
  const { ok, body } = await discordGet(`/guilds/${guildId()}/channels`)
  if (!ok || !Array.isArray(body)) return []
  return body
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
