import {
  discordErrorMessage,
  editChannelMessage,
  sendChannelMessage,
} from '@/app/api/admin/_lib/discord'
import { isButtonColor, type SelfRolesDoc, saveSelfRolesDoc } from '@/app/api/admin/_lib/selfRoles'

const BUTTON_STYLE: Record<string, number> = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
}

function buttonEmoji(raw?: string | null) {
  const emoji = String(raw || '').trim()
  if (!emoji) return undefined
  const custom = emoji.match(/^<:\w+:(\d+)>$/)
  if (custom) return { id: custom[1] }
  return { name: emoji }
}

export function buildPanelMessagePayload(panelId: string, panel: any) {
  const roles = Array.isArray(panel?.roles) ? panel.roles : []
  const name = panel?.name || panelId

  let content = `# 🔑 ${name}\n\n`
  if (panel?.description) content += `${panel.description}\n`
  else content += `Click the buttons below to add or remove roles!\n`

  if (roles.length === 0) {
    content += 'No roles are currently available in this panel.'
    return { content, components: [] as any[] }
  }

  content += `## Available Roles\n`
  content += roles.map((role: any) => {
    const description = role.description ? ` - ${role.description}` : ''
    const approvalIcon = role.requiresApproval ? ' 🔐' : ''
    const teamCaptain = role.teamCaptainId ? ` <@${role.teamCaptainId}>` : ''
    const prerequisites = Array.isArray(role.requiredRoles) && role.requiredRoles.length > 0
      ? ` (requires: ${role.requiredRoles.map((id: string) => `<@&${id}>`).join(', ')})`
      : ''
    return `${role.emoji || ''} **${role.roleName}**${description}${approvalIcon}${teamCaptain}${prerequisites}`
  }).join('\n') + '\n\n'

  if (roles.some((role: any) => role.requiresApproval)) {
    content += `🔐 = **Team Approval Required**\n\n`
  }

  if (Array.isArray(panel?.requiredRoles) && panel.requiredRoles.length > 0) {
    content += `🔒 **Required Roles**: You need: ${panel.requiredRoles.map((id: string) => `<@&${id}>`).join(', ')}\n\n`
  }

  if (panel?.footerText) {
    content += `---\n${String(panel.footerText).replace(/\\\\n/g, '\\n')}\n\n`
  } else {
    content += `---\n`
    content += `🔴 **Rød** = Løbsserie\n`
    content += `🔵 **Blå** = DZR hold\n`
    content += `**ZRL** = Zwift Racing League\n`
    content += `**DRS** = DIRT Racing Series\n\n`
    content += `🌐 **Mere information**\n`
    content += `Find fuld oversigt over DZR hold og søg hold på https://www.dzrracingseries.com/members-zone/zrl\n`
  }

  const components: any[] = []
  const maxButtons = 25
  const slice = roles.slice(0, maxButtons)
  for (let i = 0; i < slice.length; i += 5) {
    const rowRoles = slice.slice(i, i + 5)
    components.push({
      type: 1,
      components: rowRoles.map((role: any) => {
        const color = isButtonColor(role.buttonColor) ? role.buttonColor : 'Secondary'
        const button: any = {
          type: 2,
          style: BUTTON_STYLE[color] || 2,
          custom_id: `role_toggle_${panelId}_${role.roleId}`,
          label: String(role.roleName || 'Role').slice(0, 80),
        }
        const emoji = buttonEmoji(role.emoji)
        if (emoji) button.emoji = emoji
        return button
      }),
    })
  }

  if (content.length > 1900) {
    let description = content.replace(`# 🔑 ${name}\n\n`, '')
    if (description.length > 4090) description = `${description.slice(0, 4090)}...`
    return {
      content: '',
      embeds: [{ title: `🔑 ${name}`, color: 0x5865F2, description }],
      components,
    }
  }

  return { content, components }
}

export async function deployPanelMessage(panelId: string, panel: any) {
  const channelId = String(panel?.channelId || '').trim()
  if (!channelId) return { ok: false, error: 'Panel has no Discord channel' }

  const payload = buildPanelMessagePayload(panelId, panel)
  const existingId = panel?.panelMessageId ? String(panel.panelMessageId) : ''

  if (existingId) {
    const edited = await editChannelMessage(channelId, existingId, payload)
    if (edited.ok) return { ok: true, messageId: existingId }
  }

  const created = await sendChannelMessage(channelId, payload)
  if (!created.ok || !created.body?.id) {
    return {
      ok: false,
      error: discordErrorMessage(created, 'Failed to post panel message') || 'Failed to post panel message',
    }
  }
  return { ok: true, messageId: String(created.body.id) }
}

export async function deployPanelAndSave(doc: SelfRolesDoc, panelId: string) {
  const panel = doc.panels[panelId]
  if (!panel) return 'Panel not found'
  try {
    const result = await deployPanelMessage(panelId, panel)
    if (result.messageId && result.messageId !== panel.panelMessageId) {
      panel.panelMessageId = result.messageId
      await saveSelfRolesDoc(doc)
    }
    return result.ok ? null : result.error || 'Failed to update Discord panel message'
  } catch (e: any) {
    return e?.message || 'Failed to update Discord panel message'
  }
}

export function withDeployWarning(message: string, deployError: string | null) {
  if (!deployError) return message
  return `${message}. Panel message was not updated (${deployError}). Run /update_panel in Discord.`
}
