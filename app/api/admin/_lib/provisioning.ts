import { ADMIN_ROLE_ID } from '@/app/lib/sharedConstants'
import {
  ChannelType,
  createGuildChannel,
  createGuildRole,
  defaultExtraViewerRoleIds,
  deleteChannelOverwrite,
  deleteGuildChannel,
  deleteGuildRole,
  findBotRoleId,
  getBotMember,
  getChannel,
  guildId,
  listAllGuildRoles,
  privateChannelOverwrites,
  protectedRoleIds,
  replaceChannelOverwrites,
  slugifyChannelName,
} from '@/app/api/admin/_lib/discord'

export type PanelProvisioning = {
  createVoice: boolean
  textCategoryId: string | null
  voiceCategoryId: string | null
  extraViewerRoleIds: string[]
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
  const keepOverwriteIds = new Set(
    [guildId(), role.id, ADMIN_ROLE_ID, botRoleId].filter(Boolean).map(String)
  )

  async function lockChannel(channelId: string, voice: boolean) {
    const overwrites = privateChannelOverwrites({
      roleId: role.id,
      botRoleId,
      voice,
    })
    try {
      await replaceChannelOverwrites(channelId, overwrites)
    } catch {
      const withoutAdmin = overwrites.filter((o) => o.id !== ADMIN_ROLE_ID)
      await replaceChannelOverwrites(channelId, withoutAdmin).catch(() => {})
    }
    const channel = await getChannel(channelId)
    for (const overwrite of channel?.permission_overwrites || []) {
      if (!keepOverwriteIds.has(String(overwrite.id))) {
        await deleteChannelOverwrite(channelId, String(overwrite.id)).catch(() => {})
      }
    }
  }

  let textChannelId: string | null = null
  let voiceChannelId: string | null = null
  try {
    const text = await createGuildChannel({
      name: channelName,
      type: ChannelType.GuildText,
      parentId: opts.textCategoryId,
      permissionOverwrites: privateChannelOverwrites({ roleId: role.id, botRoleId }),
    })
    textChannelId = text.id
    await lockChannel(text.id, false)

    if (opts.createVoice) {
      const voice = await createGuildChannel({
        name: channelName,
        type: ChannelType.GuildVoice,
        parentId: opts.voiceCategoryId || opts.textCategoryId,
        permissionOverwrites: privateChannelOverwrites({ roleId: role.id, botRoleId, voice: true }),
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
