'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { Button, Heading, Table, Tbody, Td, Text, Th, Thead, Tr, useToast, HStack } from '@chakra-ui/react'

export default function GrowthAdminPage() {
  const toast = useToast()
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/growth')
    setData(await res.json())
  }
  useEffect(() => { load().catch(() => {}) }, [])

  async function refresh(kind: 'zwift' | 'zwiftpower') {
    setBusy(true)
    const res = await fetch(`/api/admin/growth?kind=${kind}`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    toast({ title: res.ok ? 'Refresh started' : (body.error || 'Failed'), status: res.ok ? 'success' : 'error' })
    if (res.ok) load()
  }

  return (
    <AdminShell title="Club growth">
      <Text mb={4}>Companion club members: {data?.total ?? '…'}</Text>
      <HStack mb={6}>
        <Button onClick={() => refresh('zwift')} isLoading={busy}>Refresh Zwift roster</Button>
        <Button onClick={() => refresh('zwiftpower')} isLoading={busy} variant="outline">Refresh ZwiftPower roster</Button>
      </HStack>
      <Heading size="sm" mb={3}>Cumulative by day</Heading>
      <Table size="sm">
        <Thead><Tr><Th color="gray.400">Day</Th><Th color="gray.400">Added</Th><Th color="gray.400">Cumulative</Th></Tr></Thead>
        <Tbody>
          {(data?.series || []).slice(-60).map((r: any) => (
            <Tr key={r.day}><Td>{r.day}</Td><Td>{r.added}</Td><Td>{r.cumulative}</Td></Tr>
          ))}
        </Tbody>
      </Table>
    </AdminShell>
  )
}
