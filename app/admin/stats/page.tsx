'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { SimpleGrid, Stat, StatLabel, StatNumber, Table, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react'

export default function StatsAdminPage() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    fetch('/api/admin/stats').then((r) => r.json()).then(setData).catch(() => {})
  }, [])
  if (!data) return <AdminShell title="Discord stats">Loading…</AdminShell>
  return (
    <AdminShell title="Discord stats">
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
        <Stat><StatLabel>Messages (window)</StatLabel><StatNumber>{data.total_messages}</StatNumber></Stat>
        <Stat><StatLabel>Reactions</StatLabel><StatNumber>{data.total_reactions}</StatNumber></Stat>
        <Stat><StatLabel>Voice events</StatLabel><StatNumber>{data.total_voice}</StatNumber></Stat>
        <Stat><StatLabel>Unique users</StatLabel><StatNumber>{data.unique_users}</StatNumber></Stat>
      </SimpleGrid>
      <Table size="sm">
        <Thead><Tr><Th color="gray.400">Date</Th><Th color="gray.400">Activities</Th></Tr></Thead>
        <Tbody>
          {(data.recent || []).map((r: any, i: number) => (
            <Tr key={i}><Td>{r.dateKey || String(r.timestamp || '').slice(0, 10)}</Td><Td>{r.totalActivities}</Td></Tr>
          ))}
        </Tbody>
      </Table>
    </AdminShell>
  )
}
