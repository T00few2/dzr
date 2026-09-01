'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { Box, Button, Heading, Input, Select, Table, Tbody, Td, Th, Thead, Tr, useToast, HStack } from '@chakra-ui/react'

export default function MembersAdminPage() {
  const toast = useToast()
  const [type, setType] = useState('all')
  const [members, setMembers] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [zwiftDraft, setZwiftDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function load(nextType = type) {
    setLoading(true)
    const res = await fetch(`/api/admin/members?type=${nextType}`)
    const body = await res.json()
    setMembers(body.members || [])
    setLoading(false)
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return members
    return members.filter((m) =>
      [m.username, m.displayName, m.discordID, m.zwiftId].some((v) => String(v || '').toLowerCase().includes(s))
    )
  }, [members, q])

  async function assign(discordId: string) {
    const zwiftId = (zwiftDraft[discordId] || '').trim()
    if (!zwiftId) return
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, zwiftId }),
    })
    toast({ title: res.ok ? 'Linked' : 'Failed', status: res.ok ? 'success' : 'error' })
    if (res.ok) load()
  }

  return (
    <AdminShell title="Members">
      <HStack mb={4}>
        <Select w="200px" value={type} onChange={(e) => { setType(e.target.value); load(e.target.value) }} bg="gray.900">
          <option value="all">All</option>
          <option value="linked">Linked</option>
          <option value="unlinked">Unlinked</option>
        </Select>
        <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} bg="gray.900" />
        <Button onClick={() => load()} isLoading={loading}>Refresh</Button>
      </HStack>
      <Heading size="sm" mb={3}>{filtered.length} members</Heading>
      <Box overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">Discord</Th>
              <Th color="gray.400">Zwift ID</Th>
              <Th color="gray.400">Community</Th>
              <Th color="gray.400">Companion</Th>
              <Th color="gray.400">ZP roster</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {filtered.slice(0, 400).map((m) => (
              <Tr key={m.discordID}>
                <Td>{m.displayName || m.username}<Box as="span" color="gray.500" ml={2}>{m.discordID}</Box></Td>
                <Td>
                  <Input
                    size="sm"
                    defaultValue={m.zwiftId}
                    onChange={(e) => setZwiftDraft({ ...zwiftDraft, [m.discordID]: e.target.value })}
                    bg="gray.900"
                  />
                </Td>
                <Td>{m.has_member_role ? 'yes' : ''}</Td>
                <Td>{m.in_companion ? 'yes' : ''}</Td>
                <Td>{m.in_zwiftpower ? 'yes' : ''}</Td>
                <Td><Button size="xs" onClick={() => assign(m.discordID)}>Save</Button></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </AdminShell>
  )
}
