'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import type { ZwiftEventSummary } from '@/packages/shared/zwiftEvents'
import { FiftyDetail, FiftyStatus, type FiftyPanel, type SavedEvent } from '@/app/admin/events/FiftyResults'

type SeriesDate = {
  date: string
  label: string
  route: string
  overridden: boolean
  eventId: string
  publishedRoute: string
  feedEventId: number | null
}

type SeriesView = {
  id: 'after-party' | 'zwifty-fifty'
  name: string
  routes: string[]
  dates: SeriesDate[]
  error: string
  feedUnavailable: boolean
  primeRoutes?: string[]
}

type RouteHit = { routeId: number; name: string; world: string | null }

type InspectedSubgroup = {
  id: number | null
  label: string | null
  routeId: number | null
  routeName: string | null
}

type InspectedEvent = {
  id: number
  name: string | null
  subgroups: InspectedSubgroup[]
}

type CategoryPick = {
  query: string
  results: RouteHit[]
  picked: RouteHit | null
}

type WeekRoute = {
  name: string
  url: string
  route: RouteHit | null
  warning: string
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

function GroupRide({ upcoming, feedDown }: { upcoming: ZwiftEventSummary[]; feedDown: boolean }) {
  const rides = upcoming.filter((event) => /always a race/i.test(event.name))
  const [event, setEvent] = useState<InspectedEvent | null>(null)
  const [rideDate, setRideDate] = useState('')
  const [week, setWeek] = useState<WeekRoute | null>(null)
  const [picks, setPicks] = useState<Record<string, CategoryPick>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function openRide(id: number, eventDate: string, keepNotice = false) {
    setBusy('load')
    setError('')
    setWeek(null)
    if (!keepNotice) setNotice('')
    const res = await fetch(`/api/admin/events/${id}`)
    if (!res.ok) {
      setBusy('')
      setEvent(null)
      setError(await errorMessage(res))
      return
    }
    const body = (await res.json()) as InspectedEvent
    setEvent(body)
    setRideDate(eventDate)
    const next: Record<string, CategoryPick> = {}
    for (const subgroup of body.subgroups || []) {
      if (subgroup.id == null) continue
      next[String(subgroup.id)] = { query: '', results: [], picked: null }
    }
    if (eventDate) {
      const weekRes = await fetch(`/api/admin/events/route-of-the-week?date=${encodeURIComponent(eventDate)}`)
      if (weekRes.ok) {
        const listed = (await weekRes.json()) as WeekRoute
        setWeek(listed)
        if (listed.route) {
          for (const subgroup of body.subgroups || []) {
            if (subgroup.id == null || String(subgroup.label || '').trim().toUpperCase() !== 'B') continue
            next[String(subgroup.id)] = {
              query: listed.route.name,
              results: [listed.route],
              picked: listed.route,
            }
          }
        }
      } else {
        setError(await errorMessage(weekRes))
      }
    }
    setPicks(next)
    setBusy('')
  }

  function updatePick(id: string, patch: Partial<CategoryPick>) {
    setPicks((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  async function search(id: string, query: string) {
    const q = query.trim()
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setError('Enter a route name, or a route id')
      return
    }
    setBusy(`search-${id}`)
    setError('')
    const res = await fetch(`/api/admin/events/routes?q=${encodeURIComponent(q)}`)
    setBusy('')
    if (!res.ok) {
      updatePick(id, { results: [] })
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    updatePick(id, { results: Array.isArray(body) ? body : [] })
  }

  async function apply() {
    if (!event) return
    const categories = event.subgroups.filter((subgroup) => subgroup.id != null)
    const subgroupRoutes = categories.map((subgroup) => {
      const picked = picks[String(subgroup.id)]?.picked
      return picked ? { id: subgroup.id, routeId: picked.routeId, name: picked.name, label: subgroup.label } : null
    })
    if (subgroupRoutes.some((row) => !row)) {
      setError('Pick a route for every category')
      return
    }
    const chosen = subgroupRoutes.filter((row): row is NonNullable<typeof row> => Boolean(row))
    const summary = chosen.map((row) => `${row.label || row.id}: ${row.name}`).join(', ')
    if (!window.confirm(`Update ${event.name || 'this ride'} to ${summary}?`)) return
    setBusy('apply')
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'course',
        subgroupRoutes: chosen.map((row) => ({ id: row.id, routeId: row.routeId })),
      }),
    })
    if (!res.ok) {
      setBusy('')
      setError(await errorMessage(res))
      return
    }
    await openRide(event.id, rideDate, true)
    setNotice('Saved. Category routes reloaded.')
    setBusy('')
  }

  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
      <Heading size="sm" mb={3}>
        It&apos;s always a race
      </Heading>
      <Text color="gray.400" mb={4}>
        Category B is the route of the week. Pick category A, then Apply.
      </Text>
      {feedDown ? <Text color="orange.300">The public event list is unavailable right now.</Text> : null}
      {!feedDown && rides.length === 0 ? (
        <Text color="gray.500">Zwift has not created the next It&apos;s always a race event yet.</Text>
      ) : null}
      <Stack spacing={2} mb={rides.length ? 4 : 0}>
        {rides.map((ride) => (
          <Button
            key={ride.id}
            {...readableOutline}
            justifyContent="space-between"
            borderColor={event?.id === ride.id ? 'red.400' : 'whiteAlpha.600'}
            onClick={() => void openRide(ride.id, ride.eventDate)}
            isLoading={busy === 'load'}
          >
            <Text as="span">{ride.name}</Text>
            <Text as="span" color="gray.400" fontWeight="normal">
              {ride.eventDate} · {ride.id}
            </Text>
          </Button>
        ))}
      </Stack>
      {error ? (
        <Text color="red.300" mb={3}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text color="green.300" mb={3}>
          {notice}
        </Text>
      ) : null}
      {event ? (
        <Stack spacing={4}>
          {week ? (
            <Text color="gray.300">
              Route of the week: {week.name}.{' '}
              <a href={week.url} target="_blank" rel="noreferrer">
                Zwift Insider
              </a>
              {week.warning ? ` ${week.warning}` : ''}
            </Text>
          ) : null}
          {event.subgroups.map((subgroup) => {
            const id = String(subgroup.id)
            const pick = picks[id]
            if (!pick || subgroup.id == null) return null
            return (
              <Box key={id}>
                <Text fontWeight="bold" mb={2}>
                  {subgroup.label || 'Category'}
                  {subgroup.routeName ? ` · now ${subgroup.routeName}` : ''}
                </Text>
                <Flex gap={2} mb={2} wrap="wrap">
                  <Input
                    value={pick.query}
                    onChange={(e) => updatePick(id, { query: e.target.value })}
                    placeholder="Route name or id"
                    bg="gray.900"
                    borderColor="gray.700"
                  />
                  <Button
                    type="button"
                    {...readableOutline}
                    isLoading={busy === `search-${id}`}
                    onClick={() => void search(id, pick.query)}
                  >
                    Search
                  </Button>
                </Flex>
                {pick.picked ? (
                  <Text mb={2}>
                    Selected: {pick.picked.name} ({pick.picked.routeId}
                    {pick.picked.world ? `, ${pick.picked.world}` : ''})
                  </Text>
                ) : null}
                <Stack spacing={1}>
                  {pick.results.map((route) => (
                    <Button
                      key={route.routeId}
                      type="button"
                      size="sm"
                      justifyContent="flex-start"
                      color="white"
                      variant={pick.picked?.routeId === route.routeId ? 'solid' : 'ghost'}
                      colorScheme={pick.picked?.routeId === route.routeId ? 'red' : undefined}
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={() => updatePick(id, { picked: route })}
                    >
                      {route.name} · {route.routeId}
                      {route.world ? ` · ${route.world}` : ''}
                    </Button>
                  ))}
                </Stack>
              </Box>
            )
          })}
          <Button type="button" colorScheme="red" isLoading={busy === 'apply'} alignSelf="flex-start" onClick={() => void apply()}>
            Apply
          </Button>
        </Stack>
      ) : null}
    </Box>
  )
}

type SeriesMessage = { error: string; notice: string }
type ScheduleRow = SeriesDate & {
  strong: boolean
  past: boolean
  resultsFix: SavedEvent['resultsFix']
  primesFix: SavedEvent['primesFix']
}

function scheduleRows(dates: SeriesDate[], saved: SavedEvent[]): ScheduleRow[] {
  const savedByDate = new Map(saved.map((event) => [event.date, event]))
  const pending = dates.filter((row) => !row.eventId).sort((a, b) => a.date.localeCompare(b.date))
  const nextDate = pending[0]?.date
  const upcoming = (nextDate ? dates.filter((row) => row.date >= nextDate) : dates).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const earlier = nextDate ? dates.filter((row) => row.date < nextDate) : []
  const known = new Set(dates.map((row) => row.date))
  const older = saved.filter((event) => !known.has(event.date))
  const asRow = (row: SeriesDate, strong: boolean, past: boolean): ScheduleRow => {
    const match = savedByDate.get(row.date)
    return {
      ...row,
      strong,
      past,
      resultsFix: match?.resultsFix || null,
      primesFix: match?.primesFix || null,
    }
  }
  return [
    ...upcoming.map((row) => asRow(row, row.date === nextDate, false)),
    ...earlier
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((row) => asRow(row, false, true)),
    ...older
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((event) => ({
        date: event.date,
        label: event.label,
        route: event.route,
        overridden: false,
        eventId: event.eventId,
        publishedRoute: event.route,
        feedEventId: null,
        strong: false,
        past: true,
        resultsFix: event.resultsFix,
        primesFix: event.primesFix,
      })),
  ]
}

export default function WeeklySeries({
  upcoming,
  feedDown,
}: {
  upcoming: ZwiftEventSummary[]
  feedDown: boolean
}) {
  const [series, setSeries] = useState<SeriesView[]>([])
  const [savedBySeries, setSavedBySeries] = useState<Record<string, SavedEvent[]>>({})
  const [loadError, setLoadError] = useState('')
  const [messages, setMessages] = useState<Record<string, SeriesMessage>>({})
  const [busy, setBusy] = useState('')
  const [fiftyOpen, setFiftyOpen] = useState<{ id: string; panel: FiftyPanel } | null>(null)

  function setMessage(seriesId: string, message: SeriesMessage) {
    setMessages((current) => ({ ...current, [seriesId]: message }))
  }

  async function loadSaved() {
    const ids = ['after-party', 'zwifty-fifty'] as const
    const loaded = await Promise.all(
      ids.map(async (seriesId) => {
        const res = await fetch(`/api/admin/events/results?series=${seriesId}`, { cache: 'no-store' })
        if (!res.ok) return [seriesId, []] as const
        const body = await res.json()
        return [seriesId, Array.isArray(body.events) ? body.events : []] as const
      })
    )
    setSavedBySeries(Object.fromEntries(loaded))
  }

  async function load() {
    const res = await fetch('/api/admin/events/series', { cache: 'no-store' })
    if (!res.ok) {
      setLoadError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setSeries(Array.isArray(body.series) ? body.series : [])
    await loadSaved()
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveOverride(seriesId: string, date: string, route: string) {
    setBusy(`${seriesId}:${date}`)
    setMessage(seriesId, { error: '', notice: '' })
    const res = await fetch('/api/admin/events/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series: seriesId, date, route }),
    })
    setBusy('')
    if (!res.ok) {
      setMessage(seriesId, { error: await errorMessage(res), notice: '' })
      return
    }
    const body = await res.json()
    setSeries(Array.isArray(body.series) ? body.series : [])
  }

  async function apply(item: SeriesView, row: SeriesDate) {
    const changed =
      row.eventId && row.publishedRoute && row.publishedRoute !== row.route
        ? ` The site still shows ${row.publishedRoute} until this is applied.`
        : ''
    if (
      !window.confirm(
        `Update the ${row.label} ${item.name} to ${row.route}? This sets the Zwift event, the site, and the Discord post.${changed}`
      )
    ) {
      return
    }
    setBusy(`apply:${item.id}:${row.date}`)
    setMessage(item.id, { error: '', notice: '' })
    const res = await fetch('/api/admin/events/series/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series: item.id, date: row.date }),
    })
    setBusy('')
    if (!res.ok) {
      setMessage(item.id, { error: await errorMessage(res), notice: '' })
      return
    }
    const body = await res.json()
    setSeries(Array.isArray(body.series) ? body.series : [])
    setMessage(item.id, {
      error: '',
      notice: body.discordError
        ? `Saved ${row.label}. Discord post failed: ${body.discordError}`
        : `Saved ${row.label}. Discord post sent.`,
    })
    await loadSaved()
  }

  return (
    <Stack spacing={6} mb={10}>
      <Flex justify="space-between" align="center" gap={3} wrap="wrap">
        <Heading size="md">Weekly series</Heading>
        <Button as={Link} href="/admin/events/routes" {...readableOutline} size="sm">
          Route setup
        </Button>
      </Flex>
      {loadError ? <Text color="red.300">{loadError}</Text> : null}
      {series.map((item) => {
        const message = messages[item.id]
        const primeRoutes = item.primeRoutes || []
        const showZwiftPower = item.id === 'zwifty-fifty' || primeRoutes.length > 0
        const rows = scheduleRows(item.dates, savedBySeries[item.id] || [])
        const columns = showZwiftPower ? 5 : 4
        return (
          <Box key={item.id} borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
            <Heading size="sm" mb={3}>
              {item.name}
            </Heading>
            {item.error ? (
              <Text color="red.300" mb={3}>
                {item.error}
              </Text>
            ) : null}
            {message?.error ? (
              <Text color="red.300" mb={3}>
                {message.error}
              </Text>
            ) : null}
            {message?.notice ? (
              <Text color="green.300" mb={3}>
                {message.notice}
              </Text>
            ) : null}
            {item.feedUnavailable ? (
              <Text color="orange.300" mb={3}>
                The public event list is unavailable, so Apply cannot see a new event yet.
              </Text>
            ) : null}
            <Box overflowX="auto">
              <Table size="sm" variant="unstyled">
                <Thead>
                  <Tr>
                    <Th color="gray.500">Date</Th>
                    <Th color="gray.500">Route</Th>
                    <Th color="gray.500">Status</Th>
                    <Th color="gray.500" />
                    {showZwiftPower ? <Th color="gray.500">ZwiftPower</Th> : null}
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((row) => {
                    const open = row.eventId && fiftyOpen?.id === row.eventId ? fiftyOpen.panel : null
                    return (
                      <Fragment key={row.date}>
                        <Tr bg={row.strong ? 'whiteAlpha.100' : undefined}>
                          <Td color={row.strong ? 'white' : 'gray.400'} fontWeight={row.strong ? 'semibold' : 'normal'}>
                            {row.label}
                          </Td>
                          <Td>
                            {row.past && !item.dates.some((date) => date.date === row.date) ? (
                              <Text color="gray.300">{row.route}</Text>
                            ) : (
                              <Select
                                value={row.route}
                                bg="gray.900"
                                borderColor="gray.700"
                                maxW="320px"
                                isDisabled={busy === `${item.id}:${row.date}`}
                                onChange={(e) => void saveOverride(item.id, row.date, e.target.value)}
                              >
                                {row.route && !item.routes.includes(row.route) ? (
                                  <option value={row.route}>{row.route}</option>
                                ) : null}
                                {item.routes.map((route) => (
                                  <option key={route} value={route}>
                                    {route}
                                  </option>
                                ))}
                              </Select>
                            )}
                            {row.eventId && row.publishedRoute && row.publishedRoute !== row.route ? (
                              <Text color="gray.500" fontSize="xs" mt={1}>
                                Site still shows {row.publishedRoute}
                              </Text>
                            ) : null}
                          </Td>
                          <Td>
                            <Flex gap={2} wrap="wrap">
                              {row.overridden ? <Badge colorScheme="orange">Changed</Badge> : null}
                              {row.eventId ? <Badge colorScheme="green">Event {row.eventId}</Badge> : null}
                              {!row.eventId && row.feedEventId ? <Badge colorScheme="blue">Ready to apply</Badge> : null}
                            </Flex>
                          </Td>
                          <Td>
                            {row.past && !item.dates.some((date) => date.date === row.date) ? null : (
                              <Button
                                colorScheme="red"
                                size="sm"
                                isLoading={busy === `apply:${item.id}:${row.date}`}
                                onClick={() => void apply(item, row)}
                              >
                                Apply
                              </Button>
                            )}
                          </Td>
                          {showZwiftPower ? (
                            <Td>
                              {row.eventId && (item.id === 'zwifty-fifty' || primeRoutes.includes(row.route)) ? (
                                <Stack spacing={2}>
                                  <FiftyStatus
                                    event={{
                                      date: row.date,
                                      label: row.label,
                                      route: row.route,
                                      eventId: row.eventId,
                                      resultsFix: row.resultsFix,
                                      primesFix: row.primesFix,
                                    }}
                                  />
                                  <Flex gap={2} wrap="wrap">
                                    {item.id === 'zwifty-fifty' ? (
                                      <Button
                                        {...readableOutline}
                                        size="sm"
                                        onClick={() =>
                                          setFiftyOpen(open === 'categories' ? null : { id: row.eventId, panel: 'categories' })
                                        }
                                      >
                                        Check categories
                                      </Button>
                                    ) : null}
                                    <Button
                                      {...readableOutline}
                                      size="sm"
                                      onClick={() =>
                                        setFiftyOpen(open === 'sprints' ? null : { id: row.eventId, panel: 'sprints' })
                                      }
                                    >
                                      Check sprints
                                    </Button>
                                  </Flex>
                                </Stack>
                              ) : null}
                            </Td>
                          ) : null}
                        </Tr>
                        {showZwiftPower && open ? (
                          <Tr>
                            <Td colSpan={columns} borderTopWidth="0">
                              <FiftyDetail
                                eventId={row.eventId}
                                panel={open}
                                onUpdated={() => void loadSaved()}
                              />
                            </Td>
                          </Tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )
      })}
      <GroupRide upcoming={upcoming} feedDown={feedDown} />
    </Stack>
  )
}
