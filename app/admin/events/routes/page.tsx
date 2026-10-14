'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/admin/AdminShell'
import {
  emptyCatalogRoute,
  listToText,
  textToList,
  type CatalogRoute,
} from '@/app/lib/catalogRoute'
import { Box, Button, Flex, Heading, Input, Select, Stack, Text, Textarea } from '@chakra-ui/react'

type SeriesId = 'after-party' | 'zwifty-fifty'
type RouteHit = { routeId: number; name: string; world: string | null }
type Suggestion = { match: RouteHit | null; sameName: boolean; options: RouteHit[] }

const readableOutline = {
  variant: 'outline' as const,
  color: 'white',
  borderColor: 'whiteAlpha.600',
  _hover: { bg: 'whiteAlpha.200' },
}

const field = { bg: 'gray.900', borderColor: 'gray.700' }

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => ({}))
  return String(body?.error || `Request failed (${res.status})`)
}

export default function RouteSetupPage() {
  const [series, setSeries] = useState<SeriesId>('after-party')
  const [routes, setRoutes] = useState<CatalogRoute[]>([])
  const [index, setIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<CatalogRoute>(emptyCatalogRoute())
  const [options, setOptions] = useState<RouteHit[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const fifty = series === 'zwifty-fifty'

  async function load(nextSeries = series) {
    const res = await fetch(`/api/admin/events/catalog?series=${nextSeries}`, { cache: 'no-store' })
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setRoutes(Array.isArray(body.routes) ? body.routes : [])
  }

  useEffect(() => {
    setIndex(null)
    setDraft(emptyCatalogRoute())
    setOptions([])
    void load(series)
    // The series button is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series])

  function openRoute(routeIndex: number) {
    const route = routes[routeIndex]
    if (!route) return
    setIndex(routeIndex)
    setDraft(route)
    setOptions([])
    setQuery(route.zwiftRouteName || route.route)
    setError('')
    setNotice('')
  }

  function startAdd() {
    setIndex(null)
    setDraft(emptyCatalogRoute())
    setOptions([])
    setQuery('')
    setError('')
    setNotice('')
  }

  function setField(patch: Partial<CatalogRoute>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  async function findZwift(name: string) {
    const q = name.trim()
    if (q.length < 2) {
      setError('Enter a route name to search Zwift')
      return
    }
    setBusy('find')
    setError('')
    const res = await fetch(`/api/admin/events/route-match?name=${encodeURIComponent(q)}`)
    setBusy('')
    if (!res.ok) {
      setOptions([])
      setError(await errorMessage(res))
      return
    }
    const body = (await res.json()) as Suggestion
    const found = Array.isArray(body.options) ? body.options : []
    setOptions(found)
    if (body.match) {
      setField({ zwiftRouteId: body.match.routeId, zwiftRouteName: body.match.name })
      if (!body.sameName) setNotice(`Zwift calls this ${body.match.name}. Pick another result if that is wrong.`)
    } else {
      setNotice('No single Zwift route matched. Choose one from the list, or search again.')
    }
  }

  async function searchZwift() {
    const q = query.trim()
    if (q.length < 2 && !/^\d+$/.test(q)) {
      setError('Enter a Zwift route name, or a route id')
      return
    }
    setBusy('search')
    setError('')
    const res = await fetch(`/api/admin/events/routes?q=${encodeURIComponent(q)}`)
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setOptions(Array.isArray(body) ? body : [])
  }

  async function save() {
    const route: CatalogRoute = {
      ...draft,
      route: draft.route.trim(),
      climbs: draft.climbs,
      sprints: draft.sprints,
      sprintLaps: draft.sprintLaps,
      bonus: draft.bonus,
    }
    if (!route.route) {
      setError('A route name is required')
      return
    }
    setBusy('save')
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series,
        action: index == null ? 'add' : 'update',
        index,
        route,
      }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setRoutes(Array.isArray(body.routes) ? body.routes : [])
    setNotice(index == null ? 'Route added.' : 'Route saved.')
    if (index == null) startAdd()
  }

  return (
    <AdminShell title="Route setup">
      <Text color="gray.400" mb={4}>
        These routes live in Firebase and drive the weekly rotation. The files in the site were copied in as the
        starting list. Profile images still come from the site files, named from the route.{' '}
        <Link href="/admin/events">Back to events</Link>
      </Text>
      <Flex gap={2} mb={6}>
        <Button
          {...(series === 'after-party' ? { colorScheme: 'red' as const } : readableOutline)}
          onClick={() => setSeries('after-party')}
        >
          DZR After Party
        </Button>
        <Button
          {...(series === 'zwifty-fifty' ? { colorScheme: 'red' as const } : readableOutline)}
          onClick={() => setSeries('zwifty-fifty')}
        >
          The Zwifty Fifty
        </Button>
      </Flex>
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
      <Flex gap={8} align="flex-start" wrap="wrap">
        <Stack spacing={2} flex="1" minW="260px">
          {routes.map((route, routeIndex) => (
            <Button
              key={`${route.route}-${routeIndex}`}
              {...readableOutline}
              justifyContent="space-between"
              borderColor={index === routeIndex ? 'red.400' : 'whiteAlpha.600'}
              onClick={() => openRoute(routeIndex)}
            >
              <Text as="span">{route.route}</Text>
              <Text as="span" color="gray.400" fontWeight="normal">
                {route.zwiftRouteName || 'No Zwift route'}
              </Text>
            </Button>
          ))}
          <Button colorScheme="red" onClick={startAdd}>
            Add route
          </Button>
        </Stack>
        <Box flex="2" minW="320px" borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
          <Heading size="sm" mb={4}>
            {index == null ? 'New route' : draft.route || 'Edit route'}
          </Heading>
          <Stack spacing={3}>
            <Input placeholder="Route name" value={draft.route} onChange={(e) => setField({ route: e.target.value })} {...field} />
            <Input placeholder="World" value={draft.world} onChange={(e) => setField({ world: e.target.value })} {...field} />
            <Flex gap={2}>
              <Input placeholder="Laps" value={draft.laps} onChange={(e) => setField({ laps: e.target.value })} {...field} />
              <Input
                placeholder="Distance (km)"
                value={draft.distance}
                onChange={(e) => setField({ distance: e.target.value })}
                {...field}
              />
              <Input
                placeholder="Elevation (hm)"
                value={draft.elevation}
                onChange={(e) => setField({ elevation: e.target.value })}
                {...field}
              />
            </Flex>
            {fifty ? null : (
              <Input placeholder="Finish" value={draft.finish} onChange={(e) => setField({ finish: e.target.value })} {...field} />
            )}
            <Input
              placeholder="Zwift Insider link"
              value={draft.linkRoute}
              onChange={(e) => setField({ linkRoute: e.target.value })}
              {...field}
            />
            {fifty ? (
              <>
                <Textarea
                  placeholder="Climbs, separated by commas"
                  value={listToText(draft.climbs)}
                  onChange={(e) => setField({ climbs: textToList(e.target.value) })}
                  {...field}
                />
                <Textarea
                  placeholder="Sprints, separated by commas"
                  value={listToText(draft.sprints)}
                  onChange={(e) => setField({ sprints: textToList(e.target.value) })}
                  {...field}
                />
                <Input
                  placeholder="Sprint laps, separated by commas"
                  value={listToText(draft.sprintLaps)}
                  onChange={(e) => setField({ sprintLaps: textToList(e.target.value) })}
                  {...field}
                />
                <Input
                  placeholder="Bonus seconds, separated by commas"
                  value={listToText(draft.bonus)}
                  onChange={(e) => setField({ bonus: textToList(e.target.value) })}
                  {...field}
                />
              </>
            ) : null}
            <Box>
              <Text fontSize="sm" color="gray.400" mb={2}>
                Zwift route{draft.zwiftRouteName ? `: ${draft.zwiftRouteName}` : ''}
                {draft.zwiftRouteId ? ` (${draft.zwiftRouteId})` : ''}
              </Text>
              <Flex gap={2} mb={2} wrap="wrap">
                <Button {...readableOutline} isLoading={busy === 'find'} onClick={() => void findZwift(draft.route)}>
                  Find from route name
                </Button>
              </Flex>
              <Flex gap={2} mb={2} wrap="wrap">
                <Input
                  placeholder="Search Zwift by name or id"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  {...field}
                />
                <Button {...readableOutline} isLoading={busy === 'search'} onClick={() => void searchZwift()}>
                  Search
                </Button>
              </Flex>
              {options.length ? (
                <Select
                  value={draft.zwiftRouteId ? String(draft.zwiftRouteId) : ''}
                  placeholder="Choose the Zwift route"
                  bg="gray.900"
                  borderColor="gray.700"
                  onChange={(e) => {
                    const hit = options.find((option) => String(option.routeId) === e.target.value)
                    if (!hit) return
                    setField({ zwiftRouteId: hit.routeId, zwiftRouteName: hit.name })
                  }}
                >
                  {options.map((option) => (
                    <option key={option.routeId} value={option.routeId}>
                      {option.name}
                      {option.world ? ` · ${option.world}` : ''} · {option.routeId}
                    </option>
                  ))}
                </Select>
              ) : null}
            </Box>
            <Button colorScheme="red" alignSelf="flex-start" isLoading={busy === 'save'} onClick={() => void save()}>
              {index == null ? 'Add route' : 'Save route'}
            </Button>
          </Stack>
        </Box>
      </Flex>
    </AdminShell>
  )
}
