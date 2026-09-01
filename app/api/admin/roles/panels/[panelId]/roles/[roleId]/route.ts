import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { deployPanelAndSave, withDeployWarning } from '@/app/api/admin/_lib/panelDeploy'
import { deleteProvisionedDiscordEntities } from '@/app/api/admin/_lib/provisioning'
import {
  isButtonColor,
  jsonError,
  loadSelfRolesDoc,
  nowIso,
  saveSelfRolesDoc,
} from '@/app/api/admin/_lib/selfRoles'

export async function PUT(
  req: Request,
  { params }: { params: { panelId: string; roleId: string } }
) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { panelId, roleId } = params
    const data = await req.json().catch(() => ({}))
    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)
    if (!Array.isArray(panel.roles)) panel.roles = []
    const role = panel.roles.find((r: any) => String(r.roleId) === String(roleId))
    if (!role) return jsonError('Role not found in panel', 404)

    if ('description' in data) role.description = data.description
    if ('emoji' in data) role.emoji = data.emoji
    if ('requiresApproval' in data) role.requiresApproval = Boolean(data.requiresApproval)
    if ('teamCaptainId' in data) role.teamCaptainId = data.teamCaptainId || null
    if ('roleApprovalChannelId' in data) role.roleApprovalChannelId = data.roleApprovalChannelId || null
    if ('buttonColor' in data && isButtonColor(data.buttonColor)) {
      role.buttonColor = data.buttonColor
    }
    if ('requiredRoles' in data && Array.isArray(data.requiredRoles)) {
      role.requiredRoles = data.requiredRoles.map(String)
    }
    if ('isTeamRole' in data) role.isTeamRole = Boolean(data.isTeamRole)
    if ('teamName' in data) role.teamName = data.teamName
    if ('raceSeries' in data) role.raceSeries = data.raceSeries
    if ('division' in data) role.division = data.division
    if ('rideTime' in data) role.rideTime = data.rideTime
    if ('lookingForRiders' in data) role.lookingForRiders = Boolean(data.lookingForRiders)
    if ('sortIndex' in data) role.sortIndex = data.sortIndex
    if ('visibility' in data) role.visibility = data.visibility
    if ('captainDisplayName' in data) role.captainDisplayName = data.captainDisplayName
    if ('textChannelId' in data) role.textChannelId = data.textChannelId || null
    if ('voiceChannelId' in data) role.voiceChannelId = data.voiceChannelId || null

    const now = nowIso()
    role.updatedAt = now
    panel.updatedAt = now
    await saveSelfRolesDoc(doc)

    let deployError: string | null = null
    if (data.redeploy) {
      deployError = await deployPanelAndSave(doc, panelId)
    }
    return NextResponse.json({
      success: true,
      message: withDeployWarning(`Role '${role.roleName}' updated successfully`, deployError),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to update role', 500)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { panelId: string; roleId: string } }
) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { panelId, roleId } = params
    const data = await req.json().catch(() => ({}))
    const deleteDiscordEntities = Boolean(data?.deleteDiscordEntities)
    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)
    if (!Array.isArray(panel.roles)) panel.roles = []
    const role = panel.roles.find((r: any) => String(r.roleId) === String(roleId))
    if (!role) return jsonError('Role not found in panel', 404)

    if (deleteDiscordEntities) {
      await deleteProvisionedDiscordEntities({
        role,
        panel,
        panelId,
        panels: doc.panels,
      })
    }

    panel.roles = panel.roles.filter((r: any) => String(r.roleId) !== String(roleId))
    panel.updatedAt = nowIso()
    await saveSelfRolesDoc(doc)
    const deployError = await deployPanelAndSave(doc, panelId)
    return NextResponse.json({
      success: true,
      message: withDeployWarning(
        deleteDiscordEntities ? 'Role and Discord entities deleted' : 'Role removed from panel',
        deployError
      ),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to remove role', 500)
  }
}
