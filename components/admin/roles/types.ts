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

export function channelName(channels: TextChannel[], id?: string | null) {
  return channels.find((c) => c.id === id)?.name || 'unknown'
}
