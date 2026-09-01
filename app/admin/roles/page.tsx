'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { Box, Button, Heading, Text, Textarea, useToast } from '@chakra-ui/react'

export default function RolesAdminPage() {
  const toast = useToast()
  const [json, setJson] = useState('')
  const [roles, setRoles] = useState<any[]>([])

  async function load() {
    const res = await fetch('/api/admin/roles')
    const body = await res.json()
    setRoles(body.roles || [])
    const panels: Record<string, any> = {}
    ;(body.panels || []).forEach((p: any) => {
      const { panelId, ...rest } = p
      panels[panelId] = rest
    })
    setJson(JSON.stringify(panels, null, 2))
  }

  useEffect(() => { load().catch(() => {}) }, [])

  async function save() {
    try {
      const panels = JSON.parse(json)
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panels }),
      })
      toast({ title: res.ok ? 'Saved' : 'Save failed', status: res.ok ? 'success' : 'error' })
    } catch {
      toast({ title: 'Invalid JSON', status: 'error' })
    }
  }

  return (
    <AdminShell title="Role panels">
      <Text color="gray.400" mb={3}>{roles.length} guild roles available for panel config.</Text>
      <Heading size="sm" mb={2}>selfRoles.panels JSON</Heading>
      <Textarea value={json} onChange={(e) => setJson(e.target.value)} minH="420px" fontFamily="mono" bg="gray.900" mb={4} />
      <Button onClick={save} colorScheme="red">Save panels</Button>
    </AdminShell>
  )
}
