import { ADMIN_ROLE_ID } from '@/app/lib/sharedConstants'
import {
  ChannelType,
  applyChannelOverwrite,
  botAccessOverwrites,
  createGuildChannel,
  createGuildRole,
  defaultExtraViewerRoleIds,
  deleteChannelOverwrite,
  deleteGuildChannel,
  deleteGuildRole,
  ensureBotCanManageChannel,
  findBotRoleId,
  getBotMember,
  getChannel,
  guildId,
  listAllGuildRoles,
  placeRoleBelowBot,
  privateChannelOverwrites,
  protectedRoleIds,
  slugifyChannelName,
} from '@/app/api/admin/_lib/discord'

export type PanelProvisioning = {
  createVoice: boolean
  textCategoryId: string | null
  voiceCategoryId: string | null
  extraViewerRoleIds: string[]
  roleColor: number | null
}

function parseStoredRoleColor(raw: any): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  const m = String(raw || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null
  return parseInt(m, 16)
}

export function normalizeProvisioning(raw: any): PanelProvisioning {
  let extraViewerRoleIds = defaultExtraViewerRoleIds()
  if (raw && Object.prototype.hasOwnProperty.call(raw, 'extraViewerRoleIds')) {
    extraViewerRoleIds = Array.isArray(raw.extraViewerRoleIds)
      ? raw.extraViewerRoleIds.map(String).filter(Boolean)
      : []
  }
  return {
    createVoice: Boolean(raw?.createVoice),
    textCategoryId: raw?.textCategoryId ? String(raw.textCategoryId) : null,
    voiceCategoryId: raw?.voiceCategoryId ? String(raw.voiceCategoryId) : null,
    extraViewerRoleIds,
    roleColor: parseStoredRoleColor(raw?.roleColor),
  }
}

export async function provisionDiscordRole(opts: {
  name: string
  color?: number
  createVoice: boolean
  textCategoryId: string
  voiceCategoryId?: string | null
  extraViewerRoleIds?: string[]
}) {
  const [bot, guildRoles] = await Promise.all([getBotMember(), listAllGuildRoles()])
  const botRoleId = findBotRoleId(guildRoles, bot.userId)
  const channelName = slugifyChannelName(opts.name)
  const role = await createGuildRole({ name: opts.name, color: opts.color })
  await placeRoleBelowBot(role.id, botRoleId, guildRoles)
  const keepOverwriteIds = new Set(
    [guildId(), role.id, ADMIN_ROLE_ID, botRoleId].filter(Boolean).map(String)
  )

  async function lockChannel(channelId: string, voice: boolean) {
    await ensureBotCanManageChannel(channelId, {
      botUserId: bot.userId,
      botRoleId,
      voice,
    })
    const overwrites = privateChannelOverwrites({
      roleId: role.id,
      botRoleId,
      voice,
    })
    for (const overwrite of overwrites) {
      await applyChannelOverwrite(channelId, overwrite, {
        optional: overwrite.id === ADMIN_ROLE_ID || overwrite.id === botRoleId,
      })
    }
    const channel = await getChannel(channelId)
    for (const overwrite of channel?.permission_overwrites || []) {
      const id = String(overwrite.id)
      if (keepOverwriteIds.has(id) || id === bot.userId) continue
      await deleteChannelOverwrite(channelId, id)
    }
    const after = await getChannel(channelId)
    const leftover = (after?.permission_overwrites || []).filter((overwrite) => {
      const id = String(overwrite.id)
      return !keepOverwriteIds.has(id) && id !== bot.userId
    })
    if (leftover.length) {
      const names = leftover.map((overwrite) => {
        const guildRole = guildRoles.find((r: any) => String(r.id) === String(overwrite.id))
        return guildRole?.name || overwrite.id
      })
      throw new Error(
        `Could not remove extra channel roles (${names.join(', ')}). Put DZR Bot above those roles and allow View Channel + Manage Channels on the category.`
      )
    }
  }

  let textChannelId: string | null = null
  let voiceChannelId: string | null = null
  try {
    const text = await createGuildChannel({
      name: channelName,
      type: ChannelType.GuildText,
      parentId: opts.textCategoryId,
      permissionOverwrites: botAccessOverwrites({
        botUserId: bot.userId,
        botRoleId,
      }),
    })
    textChannelId = text.id
    await lockChannel(text.id, false)

    if (opts.createVoice) {
      const voice = await createGuildChannel({
        name: channelName,
        type: ChannelType.GuildVoice,
        parentId: opts.voiceCategoryId || opts.textCategoryId,
        permissionOverwrites: botAccessOverwrites({
          botUserId: bot.userId,
          botRoleId,
          voice: true,
        }),
      })
      voiceChannelId = voice.id
      await lockChannel(voice.id, true)
    }
  } catch (err) {
    if (voiceChannelId) await deleteGuildChannel(voiceChannelId).catch(() => {})
    if (textChannelId) await deleteGuildChannel(textChannelId).catch(() => {})
    await deleteGuildRole(role.id).catch(() => {})
    throw err
  }

  return {
    roleId: role.id,
    roleName: role.name || opts.name,
    textChannelId,
    voiceChannelId,
    provisioned: true,
  }
}

export async function rollbackProvisioned(created: {
  roleId?: string | null
  textChannelId?: string | null
  voiceChannelId?: string | null
}) {
  if (created.voiceChannelId) await deleteGuildChannel(created.voiceChannelId).catch(() => {})
  if (created.textChannelId) await deleteGuildChannel(created.textChannelId).catch(() => {})
  if (created.roleId) await deleteGuildRole(created.roleId).catch(() => {})
}

function isProtectedChannel(channelId: string | null | undefined, panel: any) {
  if (!channelId) return true
  const protectedIds = new Set(
    [panel?.channelId, panel?.approvalChannelId].filter(Boolean).map(String)
  )
  return protectedIds.has(String(channelId))
}

export function roleUsedInOtherPanel(panels: Record<string, any>, panelId: string, roleId: string) {
  return Object.entries(panels || {}).some(([id, panel]) => {
    if (id === panelId) return false
    return (panel?.roles || []).some((r: any) => String(r.roleId) === String(roleId))
  })
}

export async function deleteProvisionedDiscordEntities(opts: {
  role: any
  panel: any
  panelId: string
  panels: Record<string, any>
}) {
  const roleId = String(opts.role.roleId)
  const protectedIds = protectedRoleIds()
  if (protectedIds.has(roleId)) {
    throw new Error('This Discord role is protected and cannot be deleted')
  }
  if (roleUsedInOtherPanel(opts.panels, opts.panelId, roleId)) {
    throw new Error('This Discord role is still used on another panel')
  }

  const guildRoles = await listAllGuildRoles()
  const discordRole = guildRoles.find((r: any) => String(r.id) === roleId)
  if (discordRole?.managed) {
    throw new Error('Managed Discord roles cannot be deleted')
  }

  const textChannelId = opts.role.textChannelId ? String(opts.role.textChannelId) : null
  const voiceChannelId = opts.role.voiceChannelId ? String(opts.role.voiceChannelId) : null

  if (textChannelId && !isProtectedChannel(textChannelId, opts.panel)) {
    await deleteGuildChannel(textChannelId)
  }
  if (voiceChannelId && !isProtectedChannel(voiceChannelId, opts.panel)) {
    await deleteGuildChannel(voiceChannelId)
  }
  await deleteGuildRole(roleId)
}
