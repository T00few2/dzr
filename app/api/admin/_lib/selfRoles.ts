import { NextResponse } from 'next/server'
import { adminDb } from '@/app/utils/firebaseAdminConfig'
import { COLLECTIONS } from '@/app/lib/sharedConstants'
import { guildId } from '@/app/api/admin/_lib/discord'

export type SelfRolesDoc = {
  panels: Record<string, any>
  updatedAt?: string
  [key: string]: any
}

export const BUTTON_COLORS = ['Primary', 'Secondary', 'Success', 'Danger'] as const
export type ButtonColor = (typeof BUTTON_COLORS)[number]

export function isButtonColor(value: unknown): value is ButtonColor {
  return typeof value === 'string' && (BUTTON_COLORS as readonly string[]).includes(value)
}

export function nowIso() {
  return new Date().toISOString()
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function loadSelfRolesDoc(): Promise<SelfRolesDoc> {
  const snap = await adminDb.collection(COLLECTIONS.selfRoles).doc(guildId()).get()
  const data = snap.exists ? ((snap.data() as Record<string, any>) || {}) : {}
  const panels =
    data.panels && typeof data.panels === 'object' && !Array.isArray(data.panels)
      ? { ...data.panels }
      : {}
  return { ...data, panels }
}

export async function saveSelfRolesDoc(doc: SelfRolesDoc) {
  const now = nowIso()
  await adminDb.collection(COLLECTIONS.selfRoles).doc(guildId()).set({
    ...doc,
    panels: doc.panels,
    updatedAt: now,
  })
  return now
}

export function guildRolesForSelect(roles: any[]) {
  return [...roles]
    .map((r) => ({
      id: String(r.id),
      name: r.name || 'Unknown Role',
      color: r.color ?? 0,
      position: r.position ?? 0,
    }))
    .sort((a, b) => b.position - a.position)
}

function mapNamedChannel(c: any) {
  return {
    id: String(c.id),
    name: c.name || 'unknown',
    position: c.position ?? 0,
    parent_id: c.parent_id ?? null,
  }
}

export function textChannels(channels: any[]) {
  return channels
    .filter((c) => c?.type === 0)
    .map((c) => ({ ...mapNamedChannel(c), nsfw: Boolean(c.nsfw) }))
    .sort((a, b) => a.position - b.position)
}

export function categoryChannels(channels: any[]) {
  return channels
    .filter((c) => c?.type === 4)
    .map(mapNamedChannel)
    .sort((a, b) => a.position - b.position)
}

export function voiceChannels(channels: any[]) {
  return channels
    .filter((c) => c?.type === 2)
    .map(mapNamedChannel)
    .sort((a, b) => a.position - b.position)
}

export function enrichPanels(panelsObj: Record<string, any>, guildRoles: any[]) {
  const byId: Record<string, any> = {}
  for (const r of guildRoles) byId[String(r.id)] = r

  const panels = Object.entries(panelsObj || {}).map(([panelId, panel]: [string, any]) => {
    const roles = (panel?.roles || []).map((role: any) => {
      const details = byId[String(role.roleId)] || {}
      return {
        ...role,
        roleName: details.name || role.roleName || 'Unknown Role',
        roleColor: details.color ?? 0,
        rolePosition: details.position ?? 0,
        roleExists: Boolean(details.id),
      }
    })
    return {
      ...panel,
      panelId,
      name: panel?.name || 'Unnamed Panel',
      description: panel?.description || '',
      footerText: panel?.footerText || '',
      roles,
      requiredRoles: panel?.requiredRoles || [],
      order: panel?.order ?? 0,
      panelMessageId: panel?.panelMessageId ?? null,
      provisioning: {
        createVoice: Boolean(panel?.provisioning?.createVoice),
        textCategoryId: panel?.provisioning?.textCategoryId || null,
        voiceCategoryId: panel?.provisioning?.voiceCategoryId || null,
        extraViewerRoleIds: Array.isArray(panel?.provisioning?.extraViewerRoleIds)
          ? panel.provisioning.extraViewerRoleIds.map(String)
          : undefined,
        roleColor: typeof panel?.provisioning?.roleColor === 'number' && panel.provisioning.roleColor > 0
          ? panel.provisioning.roleColor
          : null,
      },
    }
  })
  panels.sort((a, b) => (a.order || 0) - (b.order || 0))
  return panels
}
