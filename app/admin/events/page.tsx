'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import WeeklySeries from '@/app/admin/events/WeeklySeries'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Input,
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

type KitPreset = { id: string; label: string; tag: string }

type Course = {
  routeId: number | null
  routeName: string | null
  mapId: number | null
  worldId: number | null
  world: string | null
  laps: number | null
  distanceInMeters: number | null
  durationInSeconds: number | null
}

type Subgroup = Course & {
  id: number | null
  label: string | null
  eventStart: string | null
  startLocation: number | null
  jerseyHash: number | null
  bikeHash: number | null
  unlockTags: string[]
  tags: string[]
}

type InspectedEvent = Course & {
  id: number
  name: string | null
  type: string | null
  sport: string | null
  eventStart: string | null
  jerseyHash: number | null
  bikeHash: number | null
  unlockTags: string[]
  tags: string[]
  kitPresets: KitPreset[]
  url: string
  subgroups: Subgroup[]
}

type RouteHit = { routeId: number; name: string; world: string | null }

function formatStart(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDistance(meters: number | null) {
  if (!meters) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function dash(value: unknown) {
  if (value == null || value === '') return '—'
  return String(value)
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => ({}))
  return String(body?.error || body?.message || `Request failed (${res.status})`)
}

const readableOutline = {
  variant: 'outline' as const,
  color: 'white',
  borderColor: 'whiteAlpha.600',
  _hover: { bg: 'whiteAlpha.200' },
}

function TagList({ tags, scheme }: { tags: string[]; scheme: string }) {
  if (!tags.length) return <Text color="gray.500">None</Text>
  return (
    <Flex gap={2} wrap="wrap">
      {tags.map((tag) => (
        <Badge key={tag} colorScheme={scheme}>
          {tag}
        </Badge>
      ))}
    </Flex>
  )
}

function lengthLabel(laps: number | null, distanceInMeters: number | null) {
  if (laps) return `${laps} lap${laps === 1 ? '' : 's'}`
  return formatDistance(distanceInMeters)
}

export default function AdminEventsPage() {
  const [upcoming, setUpcoming] = useState<ZwiftEventSummary[]>([])
  const [feedDown, setFeedDown] = useState(false)
  const [eventId, setEventId] = useState('')
  const [event, setEvent] = useState<InspectedEvent | null>(null)
  const [listError, setListError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [extraTags, setExtraTags] = useState('')
  const [routeQuery, setRouteQuery] = useState('')
  const [routes, setRoutes] = useState<RouteHit[]>([])
  const [pickedRoute, setPickedRoute] = useState<RouteHit | null>(null)
  const [lengthMode, setLengthMode] = useState<'laps' | 'distance' | ''>('')
  const [laps, setLaps] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [notice, setNotice] = useState('')
  const detailsRef = useRef<HTMLDivElement>(null)

  async function reloadDetails(id: number) {
    const res = await fetch(`/api/admin/events/${id}`)
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    setEvent(await res.json())
    setNotice('Saved. Details reloaded.')
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/admin/events')
      if (cancelled) return
      if (!res.ok) {
        setListError(await errorMessage(res))
        return
      }
      const body = await res.json()
      setUpcoming(body.events || [])
      setFeedDown(Boolean(body.unavailable))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function inspect(id: string) {
    const trimmed = id.trim()
    if (!/^\d+$/.test(trimmed)) {
      setError('Event id must be a number')
      return
    }
    setBusy('inspect')
    setError('')
    setNotice('')
    setEventId(trimmed)
    const res = await fetch(`/api/admin/events/${trimmed}`)
    setBusy('')
    if (!res.ok) {
      setEvent(null)
      setError(await errorMessage(res))
      return
    }
    setEvent(await res.json())
    setPickedRoute(null)
    setLengthMode('')
    setLaps('')
    setDistanceKm('')
    setRoutes([])
    setRouteQuery('')
  }

  function onInspectSubmit(e: FormEvent) {
    e.preventDefault()
    void inspect(eventId)
  }

  async function addTags(tags: string[]) {
    if (!event) return
    const name = event.name || `event ${event.id}`
    if (!window.confirm(`Add ${tags.join(', ')} to ${name}? This updates the event and every category.`)) return
    setBusy('tags')
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tags', tags }),
    })
    if (!res.ok) {
      setBusy('')
      setError(await errorMessage(res))
      return
    }
    setExtraTags('')
    await reloadDetails(event.id)
    setBusy('')
  }

  function onAddExtraTags(e: FormEvent) {
    e.preventDefault()
    const tags = extraTags
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (!tags.length) {
      setError('Enter at least one tag')
      return
    }
    void addTags(tags)
  }

  async function searchRoutes(e: FormEvent) {
    e.preventDefault()
    const q = routeQuery.trim()
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setError('Enter a route name, or a route id')
      return
    }
    setBusy('routes')
    setError('')
    const res = await fetch(`/api/admin/events/routes?q=${encodeURIComponent(q)}`)
    setBusy('')
    if (!res.ok) {
      setRoutes([])
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setRoutes(Array.isArray(body) ? body : [])
  }

  async function saveCourse() {
    if (!event) return
    const body: { action: 'course'; routeId?: number; laps?: number; distanceMeters?: number } = {
      action: 'course',
    }
    if (pickedRoute) body.routeId = pickedRoute.routeId
    if (lengthMode === 'laps') {
      const n = Number(laps)
      if (!Number.isInteger(n) || n <= 0) {
        setError('Laps must be a whole number greater than 0')
        return
      }
      body.laps = n
    } else if (lengthMode === 'distance') {
      const km = Number(distanceKm)
      if (!(km > 0)) {
        setError('Distance must be greater than 0')
        return
      }
      body.distanceMeters = Math.round(km * 1000)
    }
    if (body.routeId == null && body.laps == null && body.distanceMeters == null) {
      setError('Choose a route, laps, or distance')
      return
    }
    const name = event.name || `event ${event.id}`
    const parts = [
      body.routeId != null ? `route ${pickedRoute?.name || body.routeId}` : '',
      body.laps != null ? `${body.laps} laps` : '',
      body.distanceMeters != null ? `${distanceKm} km` : '',
    ].filter(Boolean)
    if (!window.confirm(`Update ${name} to ${parts.join(', ')}? This updates the event and every category.`)) return
    setBusy('course')
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      setBusy('')
      setError(await errorMessage(res))
      return
    }
    setPickedRoute(null)
    setLengthMode('')
    setLaps('')
    setDistanceKm('')
    setRoutes([])
    setRouteQuery('')
    await reloadDetails(event.id)
    setBusy('')
  }

  return (
    <AdminShell title="Zwift events">
      <Text color="gray.400" mb={6}>
        Upcoming DZR events, plus any event id the organizer account can read. Edits are saved on Zwift.
      </Text>

      <WeeklySeries />

      <Heading size="md" mb={1}>
        Inspect an event
      </Heading>
      <Text color="gray.400" mb={4}>
        A one-off event. Pick it from the list, or enter an event id.
      </Text>

      <Flex as="form" onSubmit={onInspectSubmit} gap={2} mb={6} wrap="wrap">
        <Input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Event id"
          maxW="240px"
          bg="gray.900"
          borderColor="gray.700"
        />
        <Button type="submit" colorScheme="red" isLoading={busy === 'inspect'}>
          Inspect
        </Button>
      </Flex>

      {listError ? (
        <Text color="red.300" mb={4}>
          {listError}
        </Text>
      ) : null}
      {feedDown ? (
        <Text color="orange.300" mb={4}>
          The public event list is unavailable right now. An event id still works.
        </Text>
      ) : null}

      <Stack spacing={2} mb={8}>
        {upcoming.map((item) => (
          <Button
            key={item.id}
            w="full"
            {...readableOutline}
            justifyContent="space-between"
            borderColor={event?.id === item.id ? 'red.400' : 'whiteAlpha.600'}
            onClick={() => void inspect(String(item.id))}
          >
            <Text as="span">{item.name}</Text>
            <Text as="span" color="gray.400" fontWeight="normal">
              {item.eventDate} {item.subgroups[0]?.startTime || ''} · {item.id}
            </Text>
          </Button>
        ))}
        {!listError && !feedDown && upcoming.length === 0 ? (
          <Text color="gray.500">No upcoming DZR events in the public feed.</Text>
        ) : null}
      </Stack>

      {error ? (
        <Text color="red.300" mb={4}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text color="green.300" mb={4}>
          {notice}
        </Text>
      ) : null}

      {event ? (
        <Stack spacing={6} ref={detailsRef}>
          <Box>
            <Heading size="sm" mb={2}>
              Summary
            </Heading>
            <Text fontWeight="semibold">{event.name || 'Untitled event'}</Text>
            <Text color="gray.300">{formatStart(event.eventStart)}</Text>
            <Text mb={2}>
              <a href={event.url} target="_blank" rel="noreferrer">
                Zwift
              </a>
            </Text>
            <Text color="gray.300">
              {event.routeName || 'No route'} · {lengthLabel(event.laps, event.distanceInMeters)}
            </Text>
          </Box>

          <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
            <Heading size="sm" mb={3}>
              Tags
            </Heading>
            <Text fontSize="sm" color="gray.400" mb={2}>
              Unlocks
            </Text>
            <Box mb={4}>
              <TagList tags={event.unlockTags} scheme="green" />
            </Box>
            <Flex gap={2} wrap="wrap" mb={4}>
              {event.kitPresets.map((kit) => (
                <Button
                  key={kit.id}
                  size="sm"
                  {...readableOutline}
                  isLoading={busy === 'tags'}
                  onClick={() => void addTags([kit.tag])}
                >
                  {kit.label}
                </Button>
              ))}
            </Flex>
            <Flex as="form" onSubmit={onAddExtraTags} gap={2} wrap="wrap">
              <Input
                value={extraTags}
                onChange={(e) => setExtraTags(e.target.value)}
                placeholder="Tags, separated by spaces or commas"
                bg="gray.900"
                borderColor="gray.700"
              />
              <Button type="submit" colorScheme="red" isLoading={busy === 'tags'}>
                Add tags
              </Button>
            </Flex>
          </Box>

          <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
            <Heading size="sm" mb={3}>
              Course
            </Heading>
            <Flex as="form" onSubmit={searchRoutes} gap={2} mb={3} wrap="wrap">
              <Input
                value={routeQuery}
                onChange={(e) => setRouteQuery(e.target.value)}
                placeholder="Route name or id"
                bg="gray.900"
                borderColor="gray.700"
              />
              <Button type="submit" {...readableOutline} isLoading={busy === 'routes'}>
                Search
              </Button>
            </Flex>
            {pickedRoute ? (
              <Text mb={3}>
                Selected route: {pickedRoute.name} ({pickedRoute.routeId}
                {pickedRoute.world ? `, ${pickedRoute.world}` : ''})
              </Text>
            ) : null}
            <Stack spacing={1} mb={4}>
              {routes.map((route) => (
                <Button
                  key={route.routeId}
                  size="sm"
                  justifyContent="flex-start"
                  color="white"
                  variant={pickedRoute?.routeId === route.routeId ? 'solid' : 'ghost'}
                  colorScheme={pickedRoute?.routeId === route.routeId ? 'red' : undefined}
                  _hover={{ bg: 'whiteAlpha.200' }}
                  onClick={() => setPickedRoute(route)}
                >
                  {route.name} · {route.routeId}
                  {route.world ? ` · ${route.world}` : ''}
                </Button>
              ))}
            </Stack>
            <Flex gap={2} mb={3}>
              <Button
                size="sm"
                type="button"
                {...(lengthMode === 'laps' ? { variant: 'solid' as const, colorScheme: 'red' } : readableOutline)}
                onClick={() => setLengthMode(lengthMode === 'laps' ? '' : 'laps')}
              >
                Laps
              </Button>
              <Button
                size="sm"
                type="button"
                {...(lengthMode === 'distance' ? { variant: 'solid' as const, colorScheme: 'red' } : readableOutline)}
                onClick={() => setLengthMode(lengthMode === 'distance' ? '' : 'distance')}
              >
                Distance
              </Button>
            </Flex>
            {lengthMode === 'laps' ? (
              <Input
                mb={3}
                maxW="200px"
                value={laps}
                onChange={(e) => setLaps(e.target.value)}
                placeholder="Laps"
                bg="gray.900"
                borderColor="gray.700"
              />
            ) : null}
            {lengthMode === 'distance' ? (
              <Input
                mb={3}
                maxW="200px"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="Distance (km)"
                bg="gray.900"
                borderColor="gray.700"
              />
            ) : null}
            <Button type="button" colorScheme="red" isLoading={busy === 'course'} onClick={() => void saveCourse()}>
              Save course
            </Button>
          </Box>

          <Box>
            <Heading size="sm" mb={3}>
              Categories
            </Heading>
            <Box overflowX="auto">
              <Table size="sm" variant="unstyled">
                <Thead>
                  <Tr>
                    <Th color="gray.500">Category</Th>
                    <Th color="gray.500">Start</Th>
                    <Th color="gray.500">Route</Th>
                    <Th color="gray.500">Length</Th>
                    <Th color="gray.500">Unlocks</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {event.subgroups.map((subgroup) => (
                    <Tr key={subgroup.id ?? subgroup.label}>
                      <Td>{subgroup.label || 'Category'}</Td>
                      <Td>{formatStart(subgroup.eventStart)}</Td>
                      <Td>{subgroup.routeName || dash(subgroup.routeId)}</Td>
                      <Td>{lengthLabel(subgroup.laps, subgroup.distanceInMeters)}</Td>
                      <Td>
                        <TagList tags={subgroup.unlockTags} scheme="green" />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </Stack>
      ) : null}
    </AdminShell>
  )
}
