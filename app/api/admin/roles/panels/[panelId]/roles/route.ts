import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { deployPanelAndSave, withDeployWarning } from '@/app/api/admin/_lib/panelDeploy'
import { normalizeProvisioning, provisionDiscordRole, rollbackProvisioned } from '@/app/api/admin/_lib/provisioning'
import {
  isButtonColor,
  jsonError,
  loadSelfRolesDoc,
  nowIso,
  saveSelfRolesDoc,
} from '@/app/api/admin/_lib/selfRoles'

export async function POST(req: Request, { params }: { params: { panelId: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const panelId = params.panelId
    const data = await req.json().catch(() => ({}))
    const createDiscord = Boolean(data.createDiscord)
    let roleId = String(data.roleId || '').trim()
    let roleName = String(data.roleName || '').trim()
    let textChannelId = data.textChannelId ? String(data.textChannelId) : null
    let voiceChannelId = data.voiceChannelId ? String(data.voiceChannelId) : null
    let provisioned = Boolean(data.provisioned)
    let created: Awaited<ReturnType<typeof provisionDiscordRole>> | null = null

    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)
    if (!Array.isArray(panel.roles)) panel.roles = []

    try {
      if (createDiscord) {
        if (!roleName) return jsonError('Role name is required')
        const provisioning = normalizeProvisioning(panel.provisioning)
        const textCategoryId = String(data.textCategoryId || provisioning.textCategoryId || '').trim()
        const voiceCategoryId = String(data.voiceCategoryId || provisioning.voiceCategoryId || '').trim()
        if (!textCategoryId) {
          return jsonError('Set a text category in Edit Panel or the Add Role form')
        }
        if (provisioning.createVoice && !voiceCategoryId) {
          return jsonError('Select a voice channel category')
        }
        const roleColor = typeof data.roleColor === 'number' && data.roleColor > 0
          ? data.roleColor
          : provisioning.roleColor || undefined
        created = await provisionDiscordRole({
          name: roleName,
          color: roleColor,
          createVoice: provisioning.createVoice,
          textCategoryId,
          voiceCategoryId: voiceCategoryId || null,
          extraViewerRoleIds: provisioning.extraViewerRoleIds,
        })
        roleId = created.roleId
        roleName = created.roleName
        textChannelId = created.textChannelId
        voiceChannelId = created.voiceChannelId
        provisioned = true
      }

      if (!roleId || !roleName) {
        if (created) await rollbackProvisioned(created)
        return jsonError('Missing required field: roleId and roleName are required')
      }
      if (panel.roles.some((r: any) => String(r.roleId) === roleId)) {
        if (created) await rollbackProvisioned(created)
        return jsonError('Role already exists in this panel')
      }

      const now = nowIso()
      const buttonColor = isButtonColor(data.buttonColor) ? data.buttonColor : 'Secondary'
      panel.roles.push({
        roleId,
        roleName,
        description: data.description || null,
        emoji: data.emoji || null,
        requiresApproval: Boolean(data.requiresApproval),
        teamCaptainId: data.teamCaptainId || null,
        roleApprovalChannelId: data.roleApprovalChannelId || null,
        buttonColor,
        requiredRoles: Array.isArray(data.requiredRoles) ? data.requiredRoles.map(String) : [],
        addedAt: now,
        isTeamRole: Boolean(data.isTeamRole),
        teamName: data.teamName || null,
        raceSeries: data.raceSeries || null,
        division: data.division || null,
        rideTime: data.rideTime || null,
        lookingForRiders: Boolean(data.lookingForRiders),
        sortIndex: data.sortIndex ?? 0,
        visibility: data.visibility || 'public',
        captainDisplayName: data.captainDisplayName || null,
        textChannelId: textChannelId || null,
        voiceChannelId: voiceChannelId || null,
        provisioned,
      })
      panel.updatedAt = now
      await saveSelfRolesDoc(doc)
    } catch (e: any) {
      if (created) await rollbackProvisioned(created)
      throw e
    }
    const deployError = await deployPanelAndSave(doc, panelId)
    return NextResponse.json({
      success: true,
      message: withDeployWarning(`Role '${roleName}' added to panel`, deployError),
      roleId,
      textChannelId,
      voiceChannelId,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to add role', 500)
  }
}
