import { adminDb } from '@/app/utils/firebaseAdminConfig'

type RoleSyncResult =
  | { status: 'succeeded'; roleId: string }
  | { status: 'queued'; roleId: string; roleUpdateId: string }
  | { status: 'skipped'; reason: string }

async function discordAddRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) throw new Error(`Failed to add role: ${resp.status}`)
}

async function discordRemoveRole(guildId: string, discordId: string, roleId: string, botToken: string) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${botToken}` },
  })
  if (!resp.ok) throw new Error(`Failed to remove role: ${resp.status}`)
}

export async function syncClubMemberRole(input: {
  userId: string
  coveredThroughYear: number
  source: string
}): Promise<RoleSyncResult> {
  const userId = String(input.userId || '').trim()
  if (!userId) return { status: 'skipped', reason: 'missing_user' }

  const settingsDoc = await adminDb.collection('system_settings').doc('global').get()
  const membership = (settingsDoc.exists ? (settingsDoc.data() as any)?.membership : null) || {}
  const clubMemberRoleId = typeof membership?.clubMemberRoleId === 'string' ? membership.clubMemberRoleId : ''
  if (!clubMemberRoleId) return { status: 'skipped', reason: 'missing_club_member_role_id' }

  const guildId = String(process.env.DISCORD_GUILD_ID || '').trim()
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim()
  if (!guildId || !botToken) return { status: 'skipped', reason: 'missing_discord_env' }

  const shouldHaveRole = Number(input.coveredThroughYear) >= new Date().getUTCFullYear()
  try {
    if (shouldHaveRole) {
      await discordAddRole(guildId, userId, clubMemberRoleId, botToken)
    } else {
      await discordRemoveRole(guildId, userId, clubMemberRoleId, botToken)
    }
    return { status: 'succeeded', roleId: clubMemberRoleId }
  } catch {
    const queued = await adminDb.collection('role_updates').add({
      userId,
      guildId,
      addRoleIds: shouldHaveRole ? [clubMemberRoleId] : [],
      removeRoleIds: shouldHaveRole ? [] : [clubMemberRoleId],
      createdAt: new Date().toISOString(),
      attempt: 0,
      source: input.source,
    })
    return { status: 'queued', roleId: clubMemberRoleId, roleUpdateId: queued.id }
  }
}
