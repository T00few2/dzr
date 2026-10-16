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
import { RouteProfilePreview } from '@/components/route-profile/RouteProfilePreview'
import { foldName, type ProfileSegment, type RaceProfile } from '@/packages/shared/routeProfile'

type SeriesId = 'after-party' | 'zwifty-fifty'
type RouteHit = { routeId: number; name: string; world: string | null }
type SegmentHit = { id: string; name: string; world: string }
type Suggestion = { match: RouteHit | null; sameName: boolean; options: RouteHit[] }

const readableOutline = {
  variant: 'outline' as const,
  color: 'white',
  borderColor: 'whiteAlpha.600',
  _hover: { bg: 'whiteAlpha.200' },
}

const field = { bg: 'gray.900', borderColor: 'gray.700' }

function coreName(value: string) {
  return foldName(value)
    .replace(/\b(forward|reverse|rev)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function segmentChoices(segments: ProfileSegment[]) {
  const seen = new Set<string>()
  return segments.filter((segment) => {
    const key = `${segment.name}|${segment.direction}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function choiceValue(segment: ProfileSegment) {
  return `${segment.name}|${segment.direction}`
}

function confirmedSegment(name: string, segments: ProfileSegment[]) {
  const key = coreName(name)
  if (!key) return null
  const matches = segments.filter((segment) => coreName(segment.name) === key)
  if (!matches.length) return null
  const wantReverse = /\b(reverse|rev\.?)\b/i.test(name)
  const directed = matches.filter(
    (segment) => (segment.direction === 'reverse' || /\b(reverse|rev\.?)\b/i.test(segment.name)) === wantReverse
  )
  return directed[0] || matches[0]
}

function savedSegmentName(segment: ProfileSegment, segments: ProfileSegment[]) {
  const directions = new Set(segments.filter((item) => item.name === segment.name).map((item) => item.direction))
  if (directions.size > 1 && segment.direction === 'reverse' && !/\b(reverse|rev\.?)\b/i.test(segment.name)) {
    return `${segment.name} Rev.`
  }
  return segment.name
}

function worldLabel(world: string | null | undefined) {
  return String(world || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

function segmentKind(segment: ProfileSegment) {
  if (segment.type === 'climb') return 'Climb'
  if (segment.type === 'sprint') return 'Sprint'
  return 'Segment'
}

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
  const [sprintHits, setSprintHits] = useState<Record<number, SegmentHit[]>>({})
  const [namedSearch, setNamedSearch] = useState<Record<number, boolean>>({})
  const [routeNameSearch, setRouteNameSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [profile, setProfile] = useState<RaceProfile | null>(null)

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
    setSprintHits({})
    setNamedSearch({})
    setRouteNameSearch(false)
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
    setSprintHits({})
    setNamedSearch({})
    setRouteNameSearch(false)
    setQuery(route.zwiftRouteName || route.route)
    setProfile(null)
    setError('')
    setNotice('')
  }

  function startAdd() {
    setIndex(null)
    setDraft(emptyCatalogRoute())
    setOptions([])
    setSprintHits({})
    setNamedSearch({})
    setRouteNameSearch(false)
    setQuery('')
    setProfile(null)
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
      applyZwiftRoute(body.match, { keepSearching: !body.sameName })
      if (!body.sameName) setNotice(`Zwift calls this ${body.match.name}. Pick another result if that is wrong.`)
    } else {
      setRouteNameSearch(true)
      setNotice('No single Zwift route matched. Choose one from the list, or search again.')
    }
  }

  function applyZwiftRoute(hit: RouteHit, options?: { keepSearching?: boolean }) {
    setRouteNameSearch(Boolean(options?.keepSearching))
    setQuery(hit.name)
    setDraft((current) => ({
      ...current,
      zwiftRouteId: hit.routeId,
      zwiftRouteName: hit.name,
      world: current.world.trim() ? current.world : worldLabel(hit.world),
      route: current.route.trim() ? current.route : hit.name,
    }))
  }

  function setSprint(sprintIndex: number, name: string) {
    const sprints = draft.sprints.slice()
    sprints[sprintIndex] = name
    setField({ sprints })
  }

  function setSprintLap(sprintIndex: number, laps: string) {
    const sprintLaps = draft.sprintLaps.slice()
    while (sprintLaps.length <= sprintIndex) sprintLaps.push('')
    sprintLaps[sprintIndex] = laps
    setField({ sprintLaps })
  }

  function addSprint() {
    setField({ sprints: [...draft.sprints, ''], sprintLaps: [...draft.sprintLaps, ''] })
  }

  function selectRouteSegment(sprintIndex: number, value: string) {
    if (!profile) return
    const segment = segmentChoices(profile.segments).find((item) => choiceValue(item) === value)
    if (!segment) return
    setSprint(sprintIndex, savedSegmentName(segment, profile.segments))
    setNamedSearch((current) => ({ ...current, [sprintIndex]: false }))
    setSprintHits((current) => ({ ...current, [sprintIndex]: [] }))
  }

  function removeSprint(sprintIndex: number) {
    setSprintHits({})
    setNamedSearch({})
    setField({
      sprints: draft.sprints.filter((_, index) => index !== sprintIndex),
      sprintLaps: draft.sprintLaps.filter((_, index) => index !== sprintIndex),
    })
  }

  async function findSprint(sprintIndex: number) {
    const name = (draft.sprints[sprintIndex] || '').trim()
    if (name.length < 2) {
      setError('Enter a sprint name to search ZwiftPower')
      return
    }
    setBusy(`sprint:${sprintIndex}`)
    setError('')
    const res = await fetch(`/api/admin/events/segments?q=${encodeURIComponent(name)}`)
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    const hits = Array.isArray(body) ? (body as SegmentHit[]) : []
    setSprintHits((current) => ({ ...current, [sprintIndex]: hits }))
    const exact = hits.find((hit) => hit.name.toLowerCase() === name.toLowerCase())
    if (exact) setSprint(sprintIndex, exact.name)
    else if (!hits.length) setNotice(`ZwiftPower has no segment matching ${name}.`)
    else setNotice('Pick the ZwiftPower segment. The saved name has to match it exactly.')
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
        <Stack spacing={2} flex="1" minW="260px" maxW="360px" overflow="hidden">
          {routes.map((route, routeIndex) => (
            <Button
              key={`${route.route}-${routeIndex}`}
              {...readableOutline}
              w="100%"
              h="auto"
              whiteSpace="normal"
              overflow="hidden"
              justifyContent="space-between"
              borderColor={index === routeIndex ? 'red.400' : 'whiteAlpha.600'}
              onClick={() => openRoute(routeIndex)}
            >
              <Text as="span" noOfLines={1} textAlign="left">
                {route.route}
              </Text>
              <Text as="span" noOfLines={1} color="gray.400" fontWeight="normal" textAlign="right">
                {route.zwiftRouteName || 'No Zwift route'}
              </Text>
            </Button>
          ))}
          <Button colorScheme="red" onClick={startAdd}>
            Add route
          </Button>
        </Stack>
        <Box flex="2" minW="320px" borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
          <Flex justify="space-between" align="center" gap={3} mb={4}>
            <Heading size="sm">{index == null ? 'New route' : draft.route || 'Edit route'}</Heading>
            <Button colorScheme="red" flexShrink={0} isLoading={busy === 'save'} onClick={() => void save()}>
              {index == null ? 'Add route' : 'Save route'}
            </Button>
          </Flex>
          <Stack spacing={3}>
            {draft.zwiftRouteId && draft.zwiftRouteName && !routeNameSearch ? (
              <Flex gap={2} wrap="wrap" align="center">
                <Box flex="1" minW="180px" borderWidth="1px" borderColor="green.400" rounded="md" px={3} py={2}>
                  <Text color="white" fontWeight="semibold">
                    {draft.zwiftRouteName}
                  </Text>
                  <Text color="green.200" fontSize="sm">
                    {worldLabel(draft.world) || 'Zwift route'} · {draft.zwiftRouteId}
                  </Text>
                  {draft.route.trim() && foldName(draft.route) !== foldName(draft.zwiftRouteName) ? (
                    <Text color="gray.400" fontSize="sm">
                      Shown on the site as {draft.route}
                    </Text>
                  ) : null}
                </Box>
                <Button {...readableOutline} onClick={() => setRouteNameSearch(true)}>
                  Type a name
                </Button>
              </Flex>
            ) : (
              <Box>
                <Input
                  placeholder="Route name"
                  value={draft.route}
                  onChange={(e) => {
                    setRouteNameSearch(true)
                    setField({ route: e.target.value })
                  }}
                  {...field}
                />
                <Text fontSize="sm" color="gray.400" mt={2} mb={2}>
                  Find matches the typed name. Choose a result to select the Zwift route.
                </Text>
                <Flex gap={2} mb={2} wrap="wrap">
                  <Button {...readableOutline} isLoading={busy === 'find'} onClick={() => void findZwift(draft.route || query)}>
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
                    value=""
                    placeholder="Choose the Zwift route"
                    bg="gray.900"
                    borderColor="gray.700"
                    onChange={(e) => {
                      const hit = options.find((option) => String(option.routeId) === e.target.value)
                      if (hit) applyZwiftRoute(hit)
                    }}
                  >
                    {options.map((option) => (
                      <option key={option.routeId} value={option.routeId}>
                        {option.name}
                        {option.world ? ` · ${worldLabel(option.world)}` : ''} · {option.routeId}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </Box>
            )} />
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
                <Box>
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    Pick a segment on this route. A typed name is only for older rows: Find still searches ZwiftPower.
                  </Text>
                  <Button
                    {...readableOutline}
                    size="sm"
                    mb={2}
                    isDisabled={!profile?.sprints.length}
                    onClick={() => {
                      if (!profile?.sprints.length) return
                      const filled = draft.sprints.some((sprint) => sprint.trim())
                      if (filled && !window.confirm('Replace the sprint list with the sprints on this route?')) return
                      setNamedSearch({})
                      setField({
                        sprints: profile.sprints.map((sprint) => sprint.name),
                        sprintLaps: profile.sprints.map((sprint) => sprint.laps),
                      })
                    }}
                  >
                    Suggest sprints
                  </Button>
                  <Stack spacing={2}>
                    {draft.sprints.map((sprint, sprintIndex) => {
                      const choices = segmentChoices(profile?.segments || [])
                      const selected = confirmedSegment(sprint, profile?.segments || [])
                      const showTyped = Boolean(namedSearch[sprintIndex]) || (Boolean(sprint.trim()) && !selected)
                      return (
                        <Box key={sprintIndex}>
                          {selected && !showTyped ? (
                            <Flex gap={2} wrap="wrap" align="center">
                              <Box flex="1" minW="180px" borderWidth="1px" borderColor="green.400" rounded="md" px={3} py={2}>
                                <Text color="white" fontWeight="semibold">
                                  {selected.name}
                                </Text>
                                <Text color="green.200" fontSize="sm">
                                  {segmentKind(selected)} · {selected.direction === 'reverse' ? 'Reverse' : 'Forward'} ·{' '}
                                  {selected.fromKm.toFixed(1)} km
                                </Text>
                              </Box>
                              <Input
                                placeholder="Laps"
                                value={draft.sprintLaps[sprintIndex] || ''}
                                onChange={(e) => setSprintLap(sprintIndex, e.target.value)}
                                maxW="120px"
                                {...field}
                              />
                              <Button
                                {...readableOutline}
                                onClick={() => setNamedSearch((current) => ({ ...current, [sprintIndex]: true }))}
                              >
                                Type a name
                              </Button>
                              <Button {...readableOutline} onClick={() => removeSprint(sprintIndex)}>
                                Remove
                              </Button>
                            </Flex>
                          ) : showTyped ? (
                            <>
                              <Flex gap={2} wrap="wrap">
                                <Input
                                  placeholder="ZwiftPower segment name"
                                  value={sprint}
                                  flex="1"
                                  minW="180px"
                                  onChange={(e) => {
                                    setNamedSearch((current) => ({ ...current, [sprintIndex]: true }))
                                    setSprint(sprintIndex, e.target.value)
                                  }}
                                  {...field}
                                />
                                <Input
                                  placeholder="Laps"
                                  value={draft.sprintLaps[sprintIndex] || ''}
                                  onChange={(e) => setSprintLap(sprintIndex, e.target.value)}
                                  maxW="120px"
                                  {...field}
                                />
                                <Button
                                  {...readableOutline}
                                  isLoading={busy === `sprint:${sprintIndex}`}
                                  onClick={() => void findSprint(sprintIndex)}
                                >
                                  Find
                                </Button>
                                <Button {...readableOutline} onClick={() => removeSprint(sprintIndex)}>
                                  Remove
                                </Button>
                              </Flex>
                              {sprintHits[sprintIndex]?.length ? (
                                <Select
                                  mt={2}
                                  placeholder="Choose the ZwiftPower segment"
                                  bg="gray.900"
                                  borderColor="gray.700"
                                  value={sprintHits[sprintIndex].some((hit) => hit.name === sprint) ? sprint : ''}
                                  onChange={(e) => {
                                    const hit = sprintHits[sprintIndex].find((option) => option.name === e.target.value)
                                    if (hit) setSprint(sprintIndex, hit.name)
                                  }}
                                >
                                  {sprintHits[sprintIndex].map((hit) => (
                                    <option key={hit.id} value={hit.name}>
                                      {hit.name}
                                      {hit.world ? ` · ${hit.world}` : ''}
                                    </option>
                                  ))}
                                </Select>
                              ) : null}
                              {choices.length ? (
                                <Select
                                  mt={2}
                                  placeholder="Replace with a segment on this route"
                                  bg="gray.900"
                                  borderColor="gray.700"
                                  value=""
                                  onChange={(e) => selectRouteSegment(sprintIndex, e.target.value)}
                                >
                                  {choices.map((segment) => (
                                    <option key={choiceValue(segment)} value={choiceValue(segment)}>
                                      {segment.name} · {segmentKind(segment)} · {segment.direction === 'reverse' ? 'Reverse' : 'Forward'} ·{' '}
                                      {segment.fromKm.toFixed(1)} km
                                    </option>
                                  ))}
                                </Select>
                              ) : null}
                            </>
                          ) : (
                            <Flex gap={2} wrap="wrap" align="center">
                              <Select
                                flex="1"
                                minW="220px"
                                placeholder={choices.length ? 'Choose a segment on this route' : 'Load the route profile first'}
                                bg="gray.900"
                                borderColor="gray.700"
                                value=""
                                onChange={(e) => selectRouteSegment(sprintIndex, e.target.value)}
                              >
                                {choices.map((segment) => (
                                  <option key={choiceValue(segment)} value={choiceValue(segment)}>
                                    {segment.name} · {segmentKind(segment)} · {segment.direction === 'reverse' ? 'Reverse' : 'Forward'} ·{' '}
                                    {segment.fromKm.toFixed(1)} km
                                  </option>
                                ))}
                              </Select>
                              <Input
                                placeholder="Laps"
                                value={draft.sprintLaps[sprintIndex] || ''}
                                onChange={(e) => setSprintLap(sprintIndex, e.target.value)}
                                maxW="120px"
                                {...field}
                              />
                              <Button
                                {...readableOutline}
                                onClick={() => setNamedSearch((current) => ({ ...current, [sprintIndex]: true }))}
                              >
                                Type a name
                              </Button>
                              <Button {...readableOutline} onClick={() => removeSprint(sprintIndex)}>
                                Remove
                              </Button>
                            </Flex>
                          )}
                        </Box>
                      )
                    })}
                    <Button {...readableOutline} alignSelf="flex-start" onClick={addSprint}>
                      Add segment
                    </Button>
                  </Stack>
                </Box>
                <Input
                  placeholder="Bonus seconds, separated by commas"
                  value={listToText(draft.bonus)}
                  onChange={(e) => setField({ bonus: textToList(e.target.value) })}
                  {...field}
                />
              </>
            ) : null}
            <Button colorScheme="red" alignSelf="flex-start" isLoading={busy === 'save'} onClick={() => void save()}>
              {index == null ? 'Add route' : 'Save route'}
            </Button>
            {draft.zwiftRouteName ? (
              <RouteProfilePreview
                request={{
                  world: draft.world,
                  route: draft.zwiftRouteName,
                  laps: draft.laps,
                  distance: draft.distance,
                  finish: draft.finish,
                  climbs: draft.climbs,
                }}
                showFinish={!fifty}
                showClimbs={fifty}
                bonusSprints={
                  fifty
                    ? draft.sprints
                        .map((name, sprintIndex) => ({ name: name.trim(), laps: (draft.sprintLaps[sprintIndex] || '').trim() }))
                        .filter((row) => row.name)
                    : []
                }
                onProfile={setProfile}
              />
            ) : (
              <Text color="gray.500">Choose the Zwift route to preview the profile.</Text>
            )}
          </Stack>
        </Box>
      </Flex>
    </AdminShell>
  )
}
