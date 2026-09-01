import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { listGuildRoles, listGuildChannels } from '@/app/api/admin/_lib/discord'
import {
  enrichPanels,
  guildRolesForSelect,
  loadSelfRolesDoc,
  textChannels,
} from '@/app/api/admin/_lib/selfRoles'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const [roles, channels, doc] = await Promise.all([
    listGuildRoles(),
    listGuildChannels(),
    loadSelfRolesDoc(),
  ])
  return NextResponse.json({
    roles: guildRolesForSelect(roles),
    channels: textChannels(channels),
    panels: enrichPanels(doc.panels, roles),
  })
}
