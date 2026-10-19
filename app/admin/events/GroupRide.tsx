'use client'

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { Badge, Box, Button, Flex, Heading, Input, Link, Select, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { addDays, displayDate, parseIsoDate } from '@/packages/shared/seriesRotation'

type RideDate = {
  date: string
  label: string
  routeA: string
  overridden: boolean
  routeB: string
  routeBUrl: string
  routeBWarning: string
  eventId: string
  feedEventId: number | null
}

type RideView = {
  anchorDate: string
  routes: string[]
  started: boolean
  dates: RideDate[]
  feedUnavailable: boolean
  automation: string[]
}

const readableOutline = {
  variant: 'outline' as const,
  color: 'white',
  borderColor: 'whiteAlpha.600',
  _hover: { bg: 'whiteAlpha.200' },
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => ({}))
  return String(body?.error || body?.message || `Request failed (${res.status})`)
}

function previewWeeks(routes: string[], anchor: string): RideDate[] {
  const start = parseIsoDate(anchor)
  return Array.from({ length: 6 }, (_, index) => {
    const date = start ? addDays(start, index * 7) : ''
    return {
      date: date || `week-${index + 1}`,
      label: date ? displayDate(date) : `Week ${index + 1}`,
      routeA: routes[index % routes.length] || '',
      overridden: false,
      routeB: '',
      routeBUrl: '',
      routeBWarning: '',
      eventId: '',
      feedEventId: null,
    }
  })
}

export default function GroupRide() {
  const [view, setView] = useState<RideView | null>(null)
  const [anchorDate, setAnchorDate] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function adopt(next: RideView) {
    setView(next)
    setAnchorDate(next.anchorDate)
  }

  async function load() {
    const res = await fetch('/api/admin/events/group-ride', { cache: 'no-store' })
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    adopt((await res.json()) as RideView)
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveAnchor(date: string) {
    if (!parseIsoDate(date) || date === view?.anchorDate) return
    setBusy('anchor')
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/group-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'anchor', anchorDate: date }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    adopt((await res.json()) as RideView)
  }

  async function override(date: string, route: string) {
    setBusy(date)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/group-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override', date, route }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    adopt((await res.json()) as RideView)
  }

  async function apply(row: RideDate) {
    if (!window.confirm(`Update the ${row.label} ride to A ${row.routeA}, B ${row.routeB || 'route of the week'}?`)) return
    setBusy(`apply:${row.date}`)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/group-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apply', date: row.date }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    adopt((await res.json()) as RideView)
    setNotice(`Saved ${row.label}.`)
  }

  const routes = view?.routes || []
  const persisted = Boolean(view?.anchorDate) && anchorDate === view?.anchorDate
  const rows = routes.length
    ? persisted && view?.dates.length
      ? view.dates
      : previewWeeks(routes, anchorDate)
    : []

  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
      <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={3}>
        <Heading size="sm">It&apos;s always a race</Heading>
        <Button as={NextLink} href="/admin/events/routes?series=always-a-race" {...readableOutline} size="sm">
          Category A routes
        </Button>
      </Flex>
      {view?.automation.map((line, index) => (
        <Text key={index} color="gray.300" fontSize="sm" mb={1}>
          {line}
        </Text>
      ))}
      {view?.feedUnavailable ? (
        <Text color="orange.300" mt={3}>
          The public event list is unavailable, so Apply cannot see a new event yet.
        </Text>
      ) : null}
      {error ? (
        <Text color="red.300" mt={3}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text color="green.300" mt={3}>
          {notice}
        </Text>
      ) : null}

      {!routes.length ? (
        <Text color="gray.400" mt={4}>
          Add the category A routes in Route setup, in the order they should rotate.
        </Text>
      ) : null}

      {routes.length ? (
        <Box overflowX="auto" mt={5}>
          <Table size="sm" variant="unstyled">
            <Thead>
              <Tr>
                <Th color="gray.500">Date</Th>
                <Th color="gray.500">Category A</Th>
                <Th color="gray.500">Category B</Th>
                <Th color="gray.500">Status</Th>
                <Th color="gray.500" />
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row, index) => (
                <Tr key={row.date} bg={index === 0 ? 'whiteAlpha.100' : undefined}>
                  <Td color={index === 0 ? 'white' : 'gray.400'} fontWeight={index === 0 ? 'semibold' : 'normal'}>
                    {index === 0 && !view?.started ? (
                      <Input
                        type="date"
                        aria-label="First ride"
                        value={anchorDate}
                        bg="gray.900"
                        borderColor="gray.700"
                        maxW="11rem"
                        isDisabled={busy === 'anchor'}
                        onChange={(e) => {
                          setAnchorDate(e.target.value)
                          void saveAnchor(e.target.value)
                        }}
                      />
                    ) : (
                      row.label
                    )}
                  </Td>
                  <Td>
                    <Select
                      value={row.routeA}
                      bg="gray.900"
                      borderColor="gray.700"
                      color="white"
                      maxW="320px"
                      isDisabled={!persisted || busy === row.date || !routes.length}
                      onChange={(e) => void override(row.date, e.target.value)}
                    >
                      {row.routeA && !routes.includes(row.routeA) ? <option value={row.routeA}>{row.routeA}</option> : null}
                      {routes.map((route) => (
                        <option key={route} value={route}>
                          {route}
                        </option>
                      ))}
                    </Select>
                    {row.overridden ? (
                      <Badge colorScheme="orange" mt={1}>
                        Changed
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    {row.routeBUrl ? (
                      <Link color="orange.300" href={row.routeBUrl} isExternal>
                        {row.routeB || 'Zwift Insider'}
                      </Link>
                    ) : (
                      <Text color="gray.300">{row.routeB || 'Route of the week'}</Text>
                    )}
                    {row.routeBWarning ? (
                      <Text color="orange.300" fontSize="xs">
                        {row.routeBWarning}
                      </Text>
                    ) : null}
                  </Td>
                  <Td>
                    <Flex gap={2} wrap="wrap">
                      {row.eventId ? <Badge colorScheme="green">Event {row.eventId}</Badge> : null}
                      {!row.eventId && row.feedEventId ? <Badge colorScheme="blue">Ready to apply</Badge> : null}
                    </Flex>
                  </Td>
                  <Td>
                    <Button
                      type="button"
                      colorScheme="red"
                      size="sm"
                      isDisabled={!persisted || !row.routeA || !row.routeB || Boolean(row.routeBWarning)}
                      isLoading={busy === `apply:${row.date}`}
                      onClick={() => void apply(row)}
                    >
                      Apply
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ) : null}
    </Box>
  )
}
