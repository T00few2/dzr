'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import {
  Box,
  Button,
  Flex,
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from '@chakra-ui/react'
import PanelSidebar from '@/components/admin/roles/PanelSidebar'
import PanelSection from '@/components/admin/roles/PanelSection'
import { PanelModal, RoleModal, type RoleFormData } from '@/components/admin/roles/RoleModals'
import type { GuildRole, PanelRole, RolePanel, TextChannel } from '@/components/admin/roles/types'

async function parseApi(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed')
  return body
}

export default function RolesAdminPage() {
  const toast = useToast()
  const initialized = useRef(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [panels, setPanels] = useState<RolePanel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [channels, setChannels] = useState<TextChannel[]>([])
  const [search, setSearch] = useState('')
  const [onlyTeams, setOnlyTeams] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [panelModal, setPanelModal] = useState<{ mode: 'create' | 'edit'; panel?: RolePanel } | null>(null)
  const [roleModal, setRoleModal] = useState<{ mode: 'add' | 'edit'; panelId: string; role?: PanelRole } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/roles')
      const body = await parseApi(res)
      const nextPanels: RolePanel[] = body.panels || []
      setPanels(nextPanels)
      setRoles(body.roles || [])
      setChannels(body.channels || [])
      setSelectedIds((prev) => {
        if (!initialized.current) {
          initialized.current = true
          return nextPanels.map((p) => p.panelId)
        }
        const ids = new Set(nextPanels.map((p) => p.panelId))
        const kept = prev.filter((id) => ids.has(id))
        return kept
      })
    } catch (e: any) {
      toast({ title: e.message || 'Failed to load roles', status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const visiblePanels = useMemo(() => {
    const chosen = panels.filter((p) => selectedIds.includes(p.panelId))
    return chosen.length ? chosen : panels.slice(0, 1)
  }, [panels, selectedIds])

  const totalRoles = panels.reduce((n, p) => n + (p.roles || []).length, 0)
  const activeChannels = new Set(panels.map((p) => p.channelId).filter(Boolean)).size

  function notify(ok: boolean, message: string) {
    toast({ title: message, status: ok ? 'success' : 'error' })
  }

  async function createPanel(data: any) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/roles/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await parseApi(res)
      notify(true, body.message)
      setPanelModal(null)
      initialized.current = false
      await load()
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updatePanel(panelId: string, data: any) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/roles/panels/${panelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await parseApi(res)
      notify(true, body.message)
      setPanelModal(null)
      await load()
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function deletePanel(panel: RolePanel) {
    if (!window.confirm(`Delete panel "${panel.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/roles/panels/${panel.panelId}`, { method: 'DELETE' })
      const body = await parseApi(res)
      notify(true, body.message)
      await load()
    } catch (e: any) {
      notify(false, e.message)
    }
  }

  function rolePayload(data: RoleFormData) {
    return {
      roleId: data.roleId,
      roleName: data.roleName,
      description: data.description || null,
      emoji: data.emoji || null,
      buttonColor: data.buttonColor,
      requiredRoles: data.requiredRoles,
      requiresApproval: data.requiresApproval,
      teamCaptainId: data.teamCaptainId || null,
      roleApprovalChannelId: data.roleApprovalChannelId || null,
      isTeamRole: data.isTeamRole,
      teamName: data.teamName || null,
      raceSeries: data.raceSeries || null,
      division: data.division || null,
      rideTime: data.rideTime || null,
      lookingForRiders: data.lookingForRiders,
      sortIndex: data.sortIndex,
      visibility: data.visibility,
      captainDisplayName: data.captainDisplayName || null,
    }
  }

  async function addRole(panelId: string, data: RoleFormData) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/roles/panels/${panelId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rolePayload(data)),
      })
      const body = await parseApi(res)
      notify(true, body.message)
      setRoleModal(null)
      await load()
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateRole(panelId: string, roleId: string, data: RoleFormData) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/roles/panels/${panelId}/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rolePayload(data)),
      })
      const body = await parseApi(res)
      notify(true, body.message)
      setRoleModal(null)
      await load()
    } catch (e: any) {
      notify(false, e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeRole(panel: RolePanel, role: PanelRole) {
    if (!window.confirm(`Remove "${role.roleName}" from ${panel.name}?`)) return
    try {
      const res = await fetch(`/api/admin/roles/panels/${panel.panelId}/roles/${role.roleId}`, { method: 'DELETE' })
      const body = await parseApi(res)
      notify(true, body.message)
      await load()
    } catch (e: any) {
      notify(false, e.message)
    }
  }

  async function inlinePatch(panelId: string, roleId: string, field: string, value: any) {
    try {
      const res = await fetch(`/api/admin/roles/panels/${panelId}/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      await parseApi(res)
      setPanels((prev) => prev.map((p) => {
        if (p.panelId !== panelId) return p
        return {
          ...p,
          roles: (p.roles || []).map((r) => (r.roleId === roleId ? { ...r, [field]: value } : r)),
        }
      }))
      toast({ title: 'Updated', status: 'success', duration: 1500 })
    } catch (e: any) {
      notify(false, e.message)
    }
  }

  async function reorder(panelId: string, roleOrder: string[]) {
    try {
      const res = await fetch(`/api/admin/roles/panels/${panelId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleOrder }),
      })
      await parseApi(res)
      setPanels((prev) => prev.map((p) => {
        if (p.panelId !== panelId) return p
        const map: Record<string, PanelRole> = {}
        for (const r of p.roles || []) map[r.roleId] = r
        return { ...p, roles: roleOrder.map((id) => map[id]).filter(Boolean) }
      }))
    } catch (e: any) {
      notify(false, e.message)
    }
  }

  const editingPanel = panelModal?.panel
  const roleModalPanel = roleModal ? panels.find((p) => p.panelId === roleModal.panelId) : null

  return (
    <AdminShell title="Role Management">
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
        <Stat bg="gray.900" p={4} rounded="md" border="1px solid" borderColor="whiteAlpha.200">
          <StatLabel color="gray.400">Total Panels</StatLabel>
          <StatNumber>{panels.length}</StatNumber>
        </Stat>
        <Stat bg="gray.900" p={4} rounded="md" border="1px solid" borderColor="whiteAlpha.200">
          <StatLabel color="gray.400">Total Roles</StatLabel>
          <StatNumber>{totalRoles}</StatNumber>
        </Stat>
        <Stat bg="gray.900" p={4} rounded="md" border="1px solid" borderColor="whiteAlpha.200">
          <StatLabel color="gray.400">Active Channels</StatLabel>
          <StatNumber>{activeChannels}</StatNumber>
        </Stat>
      </SimpleGrid>

      <HStack mb={4} justify="flex-end">
        <Button onClick={() => load()} isLoading={loading} variant="outline" colorScheme="red">Refresh</Button>
        <Button colorScheme="red" onClick={() => setPanelModal({ mode: 'create' })}>Create Panel</Button>
      </HStack>

      {panels.length === 0 && !loading ? (
        <Box textAlign="center" py={16} bg="gray.900" rounded="md" border="1px solid" borderColor="whiteAlpha.200">
          <Text mb={4} color="gray.400">No Role Panels Found</Text>
          <Button colorScheme="red" onClick={() => setPanelModal({ mode: 'create' })}>Create Panel</Button>
        </Box>
      ) : (
        <Flex gap={4} direction={{ base: 'column', md: 'row' }} align="flex-start">
          <PanelSidebar
            panels={panels}
            channels={channels}
            search={search}
            onSearch={setSearch}
            onlyTeams={onlyTeams}
            onOnlyTeams={setOnlyTeams}
            selectedIds={selectedIds}
            onToggle={(id, checked) => {
              setSelectedIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))
            }}
            onSelectAll={(checked) => {
              setSelectedIds(checked ? panels.map((p) => p.panelId) : [])
            }}
          />
          <Box flex="1" minW={0}>
            {visiblePanels.map((panel) => (
              <PanelSection
                key={panel.panelId}
                panel={panel}
                channels={channels}
                onlyTeams={onlyTeams}
                onEditPanel={() => setPanelModal({ mode: 'edit', panel })}
                onDeletePanel={() => deletePanel(panel)}
                onAddRole={() => setRoleModal({ mode: 'add', panelId: panel.panelId })}
                onEditRole={(role) => setRoleModal({ mode: 'edit', panelId: panel.panelId, role })}
                onRemoveRole={(role) => removeRole(panel, role)}
                onInlinePatch={(roleId, field, value) => inlinePatch(panel.panelId, roleId, field, value)}
                onReorder={(order) => reorder(panel.panelId, order)}
              />
            ))}
          </Box>
        </Flex>
      )}

      <PanelModal
        mode={panelModal?.mode || 'create'}
        isOpen={!!panelModal}
        onClose={() => setPanelModal(null)}
        channels={channels}
        roles={roles}
        initial={editingPanel || null}
        submitting={submitting}
        onSubmit={(data) => {
          if (panelModal?.mode === 'edit' && editingPanel) {
            updatePanel(editingPanel.panelId, data)
          } else {
            createPanel(data)
          }
        }}
      />

      <RoleModal
        mode={roleModal?.mode || 'add'}
        isOpen={!!roleModal}
        onClose={() => setRoleModal(null)}
        channels={channels}
        roles={roles}
        usedRoleIds={(roleModalPanel?.roles || []).map((r) => r.roleId)}
        initial={roleModal?.role || null}
        submitting={submitting}
        onSubmit={(data) => {
          if (!roleModal) return
          if (roleModal.mode === 'edit' && roleModal.role) {
            updateRole(roleModal.panelId, roleModal.role.roleId, data)
          } else {
            addRole(roleModal.panelId, data)
          }
        }}
      />
    </AdminShell>
  )
}
