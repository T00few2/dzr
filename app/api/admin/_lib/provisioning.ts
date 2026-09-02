import {
  ChannelType,
  createGuildChannel,
  createGuildRole,
  defaultExtraViewerRoleIds,
  deleteGuildChannel,
  deleteGuildRole,
  getBotMember,
  listAllGuildRoles,
  privateChannelOverwrites,
  protectedRoleIds,
  putChannelOverwrite,
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

function extraViewersBotCanOverwrite(
  extraViewerRoleIds: string[],
  botRoleIds: string[],
  guildRoles: any[]
) {
  const byId = new Map(guildRoles.map((r: any) => [String(r.id), r]))
  const botHighest = Math.max(
    0,
    ...botRoleIds.map((id) => Number(byId.get(id)?.position ?? 0))
  )
  return extraViewerRoleIds.filter((id) => {
    const role = byId.get(String(id))
    if (!role) return false
    if (role.managed) return false
    return Number(role.position ?? 0) < botHighest
  })
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
  const extraViewerRoleIds = extraViewersBotCanOverwrite(
    opts.extraViewerRoleIds || defaultExtraViewerRoleIds(),
    bot.roleIds,
    guildRoles
  )
  const channelName = slugifyChannelName(opts.name)
  const role = await createGuildRole({ name: opts.name, color: opts.color })
  const coreOverwrites = privateChannelOverwrites({
    roleId: role.id,
    botUserId: bot.userId,
  })

  async function lockChannel(channelId: string) {
    for (const overwrite of coreOverwrites) {
      await putChannelOverwrite(channelId, overwrite)
    }
    for (const extraId of extraViewerRoleIds) {
      await putChannelOverwrite(channelId, {
        id: extraId,
        type: 0,
        allow: coreOverwrites[1]?.allow || '0',
      }).catch(() => {})
    }
  }

  let textChannelId: string | null = null
  let voiceChannelId: string | null = null
  try {
    const text = await createGuildChannel({
      name: channelName,
      type: ChannelType.GuildText,
      parentId: opts.textCategoryId,
      permissionOverwrites: coreOverwrites,
    })
    textChannelId = text.id
    await lockChannel(text.id)

    if (opts.createVoice) {
      const voice = await createGuildChannel({
        name: channelName,
        type: ChannelType.GuildVoice,
        parentId: opts.voiceCategoryId || opts.textCategoryId,
        permissionOverwrites: coreOverwrites,
      })
      voiceChannelId = voice.id
      await lockChannel(voice.id)
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
