'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import {
  Box,
  Button,
  Heading,
  Input,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'

type Person = {
  discordId: string
  username: string | null
  athleteName: string | null
  athleteId: number | null
  connected: boolean
  connectedAt: string | null
  messageCount: number
  openaiCalls: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  lastModel: string | null
  firstUsedAt: string | null
  lastUsedAt: string | null
}

type EventRow = {
  id: string
  discordId: string | null
  username: string | null
  model: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  openaiCalls: number
  at: string | null
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString()
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function CoachAdminPage() {
  const [data, setData] = useState<{ totals: any; people: Person[]; events: EventRow[] } | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/coach', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Failed to load')
      setData(body)
    } catch (err: any) {
      setError(err?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const people = data?.people || []
    const s = q.trim().toLowerCase()
    if (!s) return people
    return people.filter((p) =>
      [p.username, p.athleteName, p.discordId, p.athleteId].some((v) => String(v || '').toLowerCase().includes(s))
    )
  }, [data, q])

  if (!data && loading) return <AdminShell title="DZR Coach">Loading…</AdminShell>
  if (error && !data) {
    return (
      <AdminShell title="DZR Coach">
        <Text color="red.300">{error}</Text>
        <Button mt={4} onClick={() => load()}>Retry</Button>
      </AdminShell>
    )
  }

  const totals = data?.totals || {}

  return (
    <AdminShell title="DZR Coach">
      <Text color="gray.300" mb={6}>
        Strava sign-ups and OpenAI token usage for coaching DMs. Usage starts after the bot is redeployed with tracking.
      </Text>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={8}>
        <Stat><StatLabel>Strava connected</StatLabel><StatNumber>{fmt(totals.connected)}</StatNumber></Stat>
        <Stat><StatLabel>People</StatLabel><StatNumber>{fmt(totals.people)}</StatNumber></Stat>
        <Stat><StatLabel>Coach messages</StatLabel><StatNumber>{fmt(totals.messageCount)}</StatNumber></Stat>
        <Stat><StatLabel>OpenAI calls</StatLabel><StatNumber>{fmt(totals.openaiCalls)}</StatNumber></Stat>
        <Stat><StatLabel>Prompt tokens</StatLabel><StatNumber>{fmt(totals.promptTokens)}</StatNumber></Stat>
        <Stat><StatLabel>Total tokens</StatLabel><StatNumber>{fmt(totals.totalTokens)}</StatNumber></Stat>
      </SimpleGrid>

      <Box mb={4} display="flex" gap={3}>
        <Input placeholder="Search name / Discord ID" value={q} onChange={(e) => setQ(e.target.value)} bg="gray.900" maxW="360px" />
        <Button onClick={() => load()} isLoading={loading}>Refresh</Button>
      </Box>

      <Heading size="sm" mb={3}>{filtered.length} sign-ups / users</Heading>
      <Box overflowX="auto" mb={10}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">User</Th>
              <Th color="gray.400">Strava</Th>
              <Th color="gray.400" isNumeric>Messages</Th>
              <Th color="gray.400" isNumeric>API calls</Th>
              <Th color="gray.400" isNumeric>Prompt</Th>
              <Th color="gray.400" isNumeric>Completion</Th>
              <Th color="gray.400" isNumeric>Total tokens</Th>
              <Th color="gray.400">Last used</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((p) => (
              <Tr key={p.discordId}>
                <Td>
                  {p.username || '—'}
                  <Box as="span" color="gray.500" ml={2} fontSize="xs">{p.discordId}</Box>
                </Td>
                <Td>
                  {p.connected ? (p.athleteName || 'Connected') : 'Not connected'}
                  {p.connectedAt ? (
                    <Box color="gray.500" fontSize="xs">{fmtTime(p.connectedAt)}</Box>
                  ) : null}
                </Td>
                <Td isNumeric>{fmt(p.messageCount)}</Td>
                <Td isNumeric>{fmt(p.openaiCalls)}</Td>
                <Td isNumeric>{fmt(p.promptTokens)}</Td>
                <Td isNumeric>{fmt(p.completionTokens)}</Td>
                <Td isNumeric>{fmt(p.totalTokens)}</Td>
                <Td>{fmtTime(p.lastUsedAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Heading size="sm" mb={3}>Recent coaching calls</Heading>
      <Box overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">When</Th>
              <Th color="gray.400">User</Th>
              <Th color="gray.400">Model</Th>
              <Th color="gray.400" isNumeric>Prompt</Th>
              <Th color="gray.400" isNumeric>Completion</Th>
              <Th color="gray.400" isNumeric>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(data?.events || []).map((e) => (
              <Tr key={e.id}>
                <Td>{fmtTime(e.at)}</Td>
                <Td>
                  {e.username || '—'}
                  <Box as="span" color="gray.500" ml={2} fontSize="xs">{e.discordId}</Box>
                </Td>
                <Td>{e.model || '—'}</Td>
                <Td isNumeric>{fmt(e.promptTokens)}</Td>
                <Td isNumeric>{fmt(e.completionTokens)}</Td>
                <Td isNumeric>{fmt(e.totalTokens)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </AdminShell>
  )
}
