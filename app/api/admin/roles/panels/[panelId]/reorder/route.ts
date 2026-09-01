import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import {
  jsonError,
  loadSelfRolesDoc,
  nowIso,
  saveSelfRolesDoc,
} from '@/app/api/admin/_lib/selfRoles'

export async function PUT(req: Request, { params }: { params: { panelId: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const panelId = params.panelId
    const data = await req.json().catch(() => ({}))
    const roleOrder = data.roleOrder
    if (!Array.isArray(roleOrder)) {
      return jsonError('roleOrder must be an array')
    }

    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)
    if (!Array.isArray(panel.roles)) panel.roles = []

    const existingIds = new Set<string>(panel.roles.map((r: any) => String(r.roleId)))
    const providedIds: string[] = roleOrder.map((id: unknown) => String(id))
    const providedSet = new Set<string>(providedIds)
    if (existingIds.size !== providedSet.size || [...existingIds].some((id) => !providedSet.has(id))) {
      return jsonError('Role ID mismatch')
    }

    const roleMap: Record<string, any> = {}
    for (const role of panel.roles) roleMap[String(role.roleId)] = role
    panel.roles = providedIds.map((id: string) => roleMap[id])
    panel.updatedAt = nowIso()
    await saveSelfRolesDoc(doc)
    return NextResponse.json({ success: true, message: 'Role order updated successfully' })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to reorder roles', 500)
  }
}
