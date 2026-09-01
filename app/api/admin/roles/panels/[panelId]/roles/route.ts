import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
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
    const roleId = String(data.roleId || '').trim()
    const roleName = String(data.roleName || '').trim()
    if (!roleId || !roleName) {
      return jsonError('Missing required field: roleId and roleName are required')
    }

    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)
    if (!Array.isArray(panel.roles)) panel.roles = []
    if (panel.roles.some((r: any) => String(r.roleId) === roleId)) {
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
    })
    panel.updatedAt = now
    await saveSelfRolesDoc(doc)
    return NextResponse.json({ success: true, message: `Role '${roleName}' added to panel` })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to add role', 500)
  }
}
