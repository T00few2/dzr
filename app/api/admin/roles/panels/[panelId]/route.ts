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
    const doc = await loadSelfRolesDoc()
    const panel = doc.panels[panelId]
    if (!panel) return jsonError('Panel not found', 404)

    if ('name' in data) panel.name = data.name
    if ('description' in data) panel.description = data.description
    if ('footerText' in data) panel.footerText = data.footerText
    if ('channelId' in data) panel.channelId = data.channelId
    if ('requiredRoles' in data) {
      panel.requiredRoles = Array.isArray(data.requiredRoles) ? data.requiredRoles.map(String) : []
    }
    if ('approvalChannelId' in data) {
      panel.approvalChannelId = data.approvalChannelId || null
    }

    panel.updatedAt = nowIso()
    await saveSelfRolesDoc(doc)
    return NextResponse.json({ success: true, message: 'Panel updated successfully' })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to update panel', 500)
  }
}

export async function DELETE(req: Request, { params }: { params: { panelId: string } }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const panelId = params.panelId
    const doc = await loadSelfRolesDoc()
    if (!doc.panels[panelId]) return jsonError('Panel not found', 404)
    delete doc.panels[panelId]
    await saveSelfRolesDoc(doc)
    return NextResponse.json({ success: true, message: 'Panel deleted successfully' })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to delete panel', 500)
  }
}
