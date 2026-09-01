export type GuildRole = {
  id: string
  name: string
  color: number
  position: number
}

export type TextChannel = {
  id: string
  name: string
  position: number
  parent_id?: string | null
}

export type CategoryChannel = {
  id: string
  name: string
  position: number
}

export type PanelProvisioning = {
  createVoice?: boolean
  textCategoryId?: string | null
  voiceCategoryId?: string | null
  extraViewerRoleIds?: string[]
}

export type PanelRole = {
  roleId: string
  roleName: string
  description?: string | null
  emoji?: string | null
  buttonColor?: string
  requiredRoles?: string[]
  requiresApproval?: boolean
  teamCaptainId?: string | null
  roleApprovalChannelId?: string | null
  isTeamRole?: boolean
  teamName?: string | null
  raceSeries?: string | null
  division?: string | null
  rideTime?: string | null
  lookingForRiders?: boolean
  sortIndex?: number
  visibility?: string
  captainDisplayName?: string | null
  roleColor?: number
  roleExists?: boolean
  textChannelId?: string | null
  voiceChannelId?: string | null
  provisioned?: boolean
}

export type RolePanel = {
  panelId: string
  name: string
  description?: string
  footerText?: string
  channelId?: string
  roles: PanelRole[]
  requiredRoles?: string[]
  approvalChannelId?: string | null
  order?: number
  panelMessageId?: string | null
  provisioning?: PanelProvisioning
}

export const RACE_SERIES = ['WTRL ZRL', 'WTRL TTT', 'DRS', 'Club Ladder']

export const BUTTON_COLOR_OPTIONS = [
  { value: 'Secondary', label: 'Gray (Secondary)' },
  { value: 'Primary', label: 'Blue (Primary)' },
  { value: 'Success', label: 'Green (Success)' },
  { value: 'Danger', label: 'Red (Danger)' },
]

export function roleColorHex(color?: number) {
  if (!color) return '#6c757d'
  return `#${Number(color).toString(16).padStart(6, '0')}`
}

export function channelName(channels: { id: string; name: string }[], id?: string | null) {
  return channels.find((c) => c.id === id)?.name || 'unknown'
}

export function parseRoleColor(hex: string): number | undefined {
  const m = String(hex || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return undefined
  return parseInt(m, 16)
}
