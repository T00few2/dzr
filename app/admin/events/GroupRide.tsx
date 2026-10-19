'use client'

import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, Heading, Input, Link, Select, Stack, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'

type RideRoute = { routeId: number; name: string; world: string | null }

type RideDate = {
  date: string
  label: string
  routeA: string
  routeAId: number | null
  overridden: boolean
  routeB: string
  routeBUrl: string
  routeBWarning: string
  eventId: string
  feedEventId: number | null
}

type RideView = {
  anchorDate: string
  routes: RideRoute[]
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

export default function GroupRide() {
  const [view, setView] = useState<RideView | null>(null)
  const [routes, setRoutes] = useState<RideRoute[]>([])
  const [anchorDate, setAnchorDate] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RideRoute[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function adopt(next: RideView) {
    setView(next)
    setRoutes(next.routes)
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

  async function search() {
    const q = query.trim()
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setError('Enter a route name, or a route id')
      return
    }
    setBusy('search')
    setError('')
    const res = await fetch(`/api/admin/events/routes?q=${encodeURIComponent(q)}`)
    setBusy('')
    if (!res.ok) {
      setResults([])
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setResults(Array.isArray(body) ? body : [])
  }

  function addRoute(route: RideRoute) {
    setRoutes((current) => (current.some((row) => row.routeId === route.routeId) ? current : [...current, route]))
    setResults([])
    setQuery('')
  }

  function move(index: number, direction: -1 | 1) {
    setRoutes((current) => {
      const next = current.slice()
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row)
      return next
    })
  }

  async function saveRoutes() {
    setBusy('save')
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/group-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'routes', anchorDate, routes }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    adopt((await res.json()) as RideView)
    setNotice('Category A list saved.')
  }

  async function override(date: string, routeId: number) {
    setBusy(date)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/group-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override', date, routeId }),
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
    const body = (await res.json()) as RideView
    adopt(body)
    setNotice(`Saved ${row.label}.`)
  }

  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
      <Heading size="sm" mb={3}>
        It&apos;s always a race
      </Heading>
      <Text color="gray.400" mb={3}>
        Category B is the route of the week. Category A follows the list below, one route each week.
      </Text>
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

      <Heading size="xs" mt={5} mb={2}>
        Category A routes
      </Heading>
      <Flex gap={2} mb={3} wrap="wrap">
        <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} bg="gray.900" borderColor="gray.700" maxW="12rem" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Route name or id"
          bg="gray.900"
          borderColor="gray.700"
          maxW="18rem"
        />
        <Button type="button" {...readableOutline} isLoading={busy === 'search'} onClick={() => void search()}>
          Search
        </Button>
      </Flex>
      <Stack spacing={1} mb={3}>
        {results.map((route) => (
          <Button
            key={route.routeId}
            type="button"
            size="sm"
            justifyContent="flex-start"
            variant="ghost"
            color="white"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={() => addRoute(route)}
          >
            Add {route.name} · {route.routeId}
            {route.world ? ` · ${route.world}` : ''}
          </Button>
        ))}
      </Stack>
      <Stack spacing={2} mb={3}>
        {routes.map((route, index) => (
          <Flex key={route.routeId} gap={2} align="center">
            <Text flex="1" color="white">
              {index + 1}. {route.name}
            </Text>
            <Button type="button" size="xs" {...readableOutline} onClick={() => move(index, -1)}>
              Up
            </Button>
            <Button type="button" size="xs" {...readableOutline} onClick={() => move(index, 1)}>
              Down
            </Button>
            <Button type="button" size="xs" {...readableOutline} onClick={() => setRoutes(routes.filter((row) => row.routeId !== route.routeId))}>
              Remove
            </Button>
          </Flex>
        ))}
      </Stack>
      <Button type="button" colorScheme="red" size="sm" isLoading={busy === 'save'} onClick={() => void saveRoutes()}>
        Save category A
      </Button>

      {view?.dates.length ? (
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
              {view.dates.map((row) => (
                <Tr key={row.date}>
                  <Td color="white">{row.label}</Td>
                  <Td>
                    <Select
                      value={row.routeAId || ''}
                      bg="gray.900"
                      borderColor="gray.700"
                      color="white"
                      isDisabled={busy === row.date || !view.routes.length}
                      onChange={(e) => void override(row.date, Number(e.target.value))}
                    >
                      {view.routes.map((route) => (
                        <option key={route.routeId} value={route.routeId}>
                          {route.name}
                        </option>
                      ))}
                    </Select>
                    {row.overridden ? <Badge colorScheme="orange" mt={1}>Changed</Badge> : null}
                  </Td>
                  <Td>
                    {row.routeBUrl ? (
                      <Link color="orange.300" href={row.routeBUrl} isExternal>
                        {row.routeB || 'Zwift Insider'}
                      </Link>
                    ) : (
                      <Text color="gray.300">{row.routeB || '—'}</Text>
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
                      isDisabled={!row.routeAId || !row.routeB || Boolean(row.routeBWarning)}
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
