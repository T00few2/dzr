import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { normalizeProvisioning } from '@/app/api/admin/_lib/provisioning'
import {
  jsonError,
  loadSelfRolesDoc,
  nowIso,
  saveSelfRolesDoc,
} from '@/app/api/admin/_lib/selfRoles'

const PANEL_ID_RE = /^[a-z0-9][a-z0-9_-]*$/

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const data = await req.json().catch(() => ({}))
    const panelId = String(data.panelId || '').trim()
    const channelId = String(data.channelId || '').trim()
    const name = String(data.name || '').trim()
    if (!panelId || !channelId || !name) {
      return jsonError('Missing required field: panelId, channelId, and name are required')
    }
    if (!PANEL_ID_RE.test(panelId)) {
      return jsonError('Panel ID must be lowercase letters, numbers, hyphens, or underscores')
    }

    const doc = await loadSelfRolesDoc()
    if (doc.panels[panelId]) {
      return jsonError('Panel ID already exists')
    }

    const now = nowIso()
    doc.panels[panelId] = {
      channelId,
      name,
      description: data.description || 'Click the buttons below to add or remove roles!',
      footerText: data.footerText || '',
      roles: [],
      panelMessageId: null,
      requiredRoles: Array.isArray(data.requiredRoles) ? data.requiredRoles.map(String) : [],
      approvalChannelId: data.approvalChannelId || null,
      provisioning: normalizeProvisioning(data.provisioning),
      order: Object.keys(doc.panels).length + 1,
      createdAt: now,
      updatedAt: now,
    }
    await saveSelfRolesDoc(doc)
    return NextResponse.json({ success: true, message: `Panel '${name}' created successfully` })
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to create panel', 500)
  }
}
