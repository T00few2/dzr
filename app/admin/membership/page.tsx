'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { Box, Button, Heading, Input, Table, Tbody, Td, Text, Th, Thead, Tr, useToast, HStack } from '@chakra-ui/react'

export default function MembershipAdminPage() {
  const toast = useToast()
  const [settings, setSettings] = useState({ minAmountDkk: 10, maxAmountDkk: 100, clubMemberRoleId: '' })
  const [payments, setPayments] = useState<any[]>([])
  const [totals, setTotals] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const [s, p, t] = await Promise.all([
      fetch('/api/admin/membership/settings').then((r) => r.json()),
      fetch('/api/admin/membership/payments').then((r) => r.json()),
      fetch('/api/admin/membership/totals').then((r) => r.json()),
    ])
    setSettings({
      minAmountDkk: s.minAmountDkk,
      maxAmountDkk: s.maxAmountDkk,
      clubMemberRoleId: s.clubMemberRoleId || '',
    })
    setPayments(p.payments || [])
    setTotals(t.totals || [])
  }

  useEffect(() => { load().catch(() => {}) }, [])

  async function save() {
    setBusy(true)
    const res = await fetch('/api/admin/membership/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setBusy(false)
    toast({ title: res.ok ? 'Settings saved' : 'Save failed', status: res.ok ? 'success' : 'error' })
  }

  async function reconcile() {
    setBusy(true)
    const res = await fetch('/api/admin/membership/reconcile', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    toast({
      title: res.ok ? `Reconciled ${body.total_users || 0} users` : (body.error || 'Failed'),
      status: res.ok ? 'success' : 'error',
    })
  }

  return (
    <AdminShell title="Membership">
      <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={5} mb={6}>
        <Heading size="sm" mb={3}>Settings</Heading>
        <HStack mb={3} align="end">
          <Box>
            <Text fontSize="sm">Min DKK</Text>
            <Input type="number" value={settings.minAmountDkk} onChange={(e) => setSettings({ ...settings, minAmountDkk: Number(e.target.value) })} bg="gray.900" />
          </Box>
          <Box>
            <Text fontSize="sm">Max DKK</Text>
            <Input type="number" value={settings.maxAmountDkk} onChange={(e) => setSettings({ ...settings, maxAmountDkk: Number(e.target.value) })} bg="gray.900" />
          </Box>
          <Box flex="1">
            <Text fontSize="sm">Club member Discord role ID</Text>
            <Input value={settings.clubMemberRoleId} onChange={(e) => setSettings({ ...settings, clubMemberRoleId: e.target.value })} bg="gray.900" />
          </Box>
        </HStack>
        <HStack>
          <Button onClick={save} isLoading={busy} colorScheme="red">Save settings</Button>
          <Button onClick={reconcile} isLoading={busy} variant="outline">Reconcile roles</Button>
          <Button as="a" href="/api/admin/membership/payments.csv" variant="outline">Download CSV</Button>
        </HStack>
      </Box>

      <Heading size="sm" mb={3}>Totals per year</Heading>
      <Table size="sm" mb={8}>
        <Thead><Tr><Th color="gray.400">Year</Th><Th color="gray.400">Amount DKK</Th><Th color="gray.400">Count</Th></Tr></Thead>
        <Tbody>
          {totals.map((t) => (
            <Tr key={t.year}><Td>{t.year}</Td><Td>{t.totalAmountDkk}</Td><Td>{t.count}</Td></Tr>
          ))}
        </Tbody>
      </Table>

      <Heading size="sm" mb={3}>Payments ({payments.length})</Heading>
      <Box overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">When</Th>
              <Th color="gray.400">Name</Th>
              <Th color="gray.400">Amount</Th>
              <Th color="gray.400">Status</Th>
              <Th color="gray.400">Zwift ID</Th>
            </Tr>
          </Thead>
          <Tbody>
            {payments.slice(0, 200).map((p) => (
              <Tr key={p.id}>
                <Td>{String(p.createdAt || p.paidAt || '').slice(0, 19)}</Td>
                <Td>{p.fullName || p.discordId}</Td>
                <Td>{p.amountDkk}</Td>
                <Td>{p.status}</Td>
                <Td>{p.zwiftId}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </AdminShell>
  )
}
