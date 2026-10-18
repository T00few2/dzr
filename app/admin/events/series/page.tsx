'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/admin/AdminShell'
import { Button, Flex, Heading, Image, Input, Select, Stack, Switch, Text, Textarea } from '@chakra-ui/react'

type Kind = 'weekly' | 'limited'
type PointsRow = { label: string; points: string }
type RaceStart = { time: string; eventId: string }
type SeriesRace = { date: string; route: string; label: string; match: string; starts: RaceStart[] }
type CatalogRoute = { route: string }
type PlannedRace = { date: string; label: string; routeName: string; starts: RaceStart[] }

type SeriesDraft = {
  slug: string
  name: string
  intro: string
  timeLabel: string
  kind: Kind
  zwiftName: string
  published: boolean
  logoUrl: string
  rulesText: string
  pointsNote: string
  pointsRows: PointsRow[]
  leagueUrl: string
  anchorDate: string
  anchorIndex: number
  overrides: Record<string, string>
  races: SeriesRace[]
  discordWebhookSet: boolean
}

const emptyDraft = (): SeriesDraft => ({
  slug: '',
  name: '',
  intro: '',
  timeLabel: '',
  kind: 'weekly',
  zwiftName: '',
  published: false,
  logoUrl: '',
  rulesText: '',
  pointsNote: '',
  pointsRows: [],
  leagueUrl: '',
  anchorDate: '',
  anchorIndex: 0,
  overrides: {},
  races: [],
  discordWebhookSet: false,
})

const field = { bg: 'gray.900', borderColor: 'gray.700', color: 'white' }

function fromApi(series: Record<string, unknown>): SeriesDraft {
  const rules = Array.isArray(series.rules) ? series.rules.map(String) : []
  return {
    slug: String(series.slug || ''),
    name: String(series.name || ''),
    intro: String(series.intro || ''),
    timeLabel: String(series.timeLabel || ''),
    kind: series.kind === 'limited' ? 'limited' : 'weekly',
    zwiftName: String(series.zwiftName || ''),
    published: Boolean(series.published),
    logoUrl: String(series.logoUrl || ''),
    rulesText: rules.join('\n'),
    pointsNote: String(series.pointsNote || ''),
    pointsRows: Array.isArray(series.pointsRows) ? (series.pointsRows as PointsRow[]) : [],
    leagueUrl: String(series.leagueUrl || ''),
    anchorDate: String(series.anchorDate || ''),
    anchorIndex: Number(series.anchorIndex) || 0,
    overrides: (series.overrides || {}) as Record<string, string>,
    races: Array.isArray(series.races) ? (series.races as SeriesRace[]) : [],
    discordWebhookSet: Boolean(series.discordWebhookSet),
  }
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => ({}))
  return String(body?.error || `Request failed (${res.status})`)
}

export default function EventSeriesAdminPage() {
  const [list, setList] = useState<{ slug: string; name: string }[]>([])
  const [draft, setDraft] = useState<SeriesDraft>(emptyDraft())
  const [routes, setRoutes] = useState<CatalogRoute[]>([])
  const [schedule, setSchedule] = useState<PlannedRace[]>([])
  const [webhook, setWebhook] = useState('')
  const [clearWebhook, setClearWebhook] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  function patch(next: Partial<SeriesDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  async function loadList() {
    const res = await fetch('/api/admin/events/event-series', { cache: 'no-store' })
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setList(Array.isArray(body.series) ? body.series : [])
  }

  async function openSeries(slug: string) {
    setBusy('load')
    setError('')
    setWebhook('')
    setClearWebhook(false)
    setLogoFile(null)
    const res = await fetch(`/api/admin/events/event-series?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setDraft(fromApi(body.series))
    setRoutes(Array.isArray(body.routes) ? body.routes : [])
    setSchedule(Array.isArray(body.schedule) ? body.schedule : [])
  }

  useEffect(() => {
    void loadList()
  }, [])

  async function save() {
    setBusy('save')
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/event-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook,
        clearWebhook,
        series: {
          ...draft,
          rules: draft.rulesText.split('\n').map((line) => line.trim()).filter(Boolean),
        },
      }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    const saved = fromApi(body.series)
    setDraft(saved)
    setWebhook('')
    setClearWebhook(false)
    if (logoFile) {
      const form = new FormData()
      form.set('slug', saved.slug)
      form.set('logo', logoFile)
      const uploaded = await fetch('/api/admin/events/event-series/logo', { method: 'POST', body: form })
      if (!uploaded.ok) {
        setError(await errorMessage(uploaded))
        await loadList()
        return
      }
      const logo = await uploaded.json()
      setDraft((current) => ({ ...current, logoUrl: String(logo.logoUrl || '') }))
      setLogoFile(null)
    }
    setNotice('Series saved.')
    await loadList()
    if (saved.slug) await openSeries(saved.slug)
  }

  async function changeWeek(date: string, route: string) {
    setBusy(date)
    setError('')
    const res = await fetch('/api/admin/events/event-series/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override', slug: draft.slug, date, route }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    await openSeries(draft.slug)
  }

  async function apply(date: string, route: string) {
    if (!window.confirm(`Update the Zwift event on ${date} to ${route}?`)) return
    setBusy(`apply:${date}:${route}`)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/event-series/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: draft.slug, date, route }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setNotice(body.discordError ? `Zwift updated. Discord: ${body.discordError}` : 'Zwift updated and posted to Discord.')
    await openSeries(draft.slug)
  }

  function updateRace(index: number, patchRace: Partial<SeriesRace>) {
    const races = draft.races.map((race, raceIndex) => (raceIndex === index ? { ...race, ...patchRace } : race))
    patch({ races })
  }

  return (
    <AdminShell title="Event series">
      <Text color="gray.400" mb={4}>
        A new series gets its own page. After Party and The Zwifty Fifty stay on their current pages.{' '}
        <Link href="/admin/events">Back to events</Link>
      </Text>
      {error ? <Text color="red.300" mb={3}>{error}</Text> : null}
      {notice ? <Text color="green.300" mb={3}>{notice}</Text> : null}
      <Flex gap={6} align="flex-start" wrap="wrap">
        <Stack minW="220px" spacing={2}>
          <Button colorScheme="red" onClick={() => setDraft(emptyDraft())}>New series</Button>
          {list.map((item) => (
            <Button
              key={item.slug}
              justifyContent="flex-start"
              variant={draft.slug === item.slug ? 'solid' : 'outline'}
              colorScheme={draft.slug === item.slug ? 'red' : undefined}
              color="white"
              onClick={() => void openSeries(item.slug)}
            >
              {item.name}
            </Button>
          ))}
        </Stack>
        <Stack flex="1" minW="320px" spacing={3}>
          <Input placeholder="Name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} {...field} />
          <Input
            placeholder="Page address, such as santa-league"
            value={draft.slug}
            isReadOnly={list.some((item) => item.slug === draft.slug)}
            onChange={(e) => patch({ slug: e.target.value })}
            {...field}
          />
          <Textarea placeholder="Introduction" value={draft.intro} onChange={(e) => patch({ intro: e.target.value })} {...field} />
          <Input placeholder="Time, such as Sundays 14:45 CET" value={draft.timeLabel} onChange={(e) => patch({ timeLabel: e.target.value })} {...field} />
          <Input placeholder="Words in the Zwift event name" value={draft.zwiftName} onChange={(e) => patch({ zwiftName: e.target.value })} {...field} />
          <Select value={draft.kind} onChange={(e) => patch({ kind: e.target.value as Kind })} {...field}>
            <option value="weekly">Weekly series</option>
            <option value="limited">Short series</option>
          </Select>
          <Flex align="center" gap={3}>
            <Switch colorScheme="red" isChecked={draft.published} onChange={(e) => patch({ published: e.target.checked })} />
            <Text color="white">Show on the site</Text>
          </Flex>
          <Textarea
            placeholder="Rules, one on each line"
            value={draft.rulesText}
            onChange={(e) => patch({ rulesText: e.target.value })}
            {...field}
          />
          {draft.logoUrl ? <Image src={draft.logoUrl} alt="" maxH="120px" objectFit="contain" /> : null}
          <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} {...field} />
          <Heading size="sm" color="white">Points</Heading>
          <Input placeholder="Note, such as Best 4 results count" value={draft.pointsNote} onChange={(e) => patch({ pointsNote: e.target.value })} {...field} />
          {draft.pointsRows.map((row, index) => (
            <Flex key={index} gap={2}>
              <Input
                placeholder="Label"
                value={row.label}
                onChange={(e) => {
                  const pointsRows = draft.pointsRows.slice()
                  pointsRows[index] = { ...row, label: e.target.value }
                  patch({ pointsRows })
                }}
                {...field}
              />
              <Input
                placeholder="Points"
                value={row.points}
                onChange={(e) => {
                  const pointsRows = draft.pointsRows.slice()
                  pointsRows[index] = { ...row, points: e.target.value }
                  patch({ pointsRows })
                }}
                {...field}
              />
              <Button onClick={() => patch({ pointsRows: draft.pointsRows.filter((_, rowIndex) => rowIndex !== index) })}>Remove</Button>
            </Flex>
          ))}
          <Button alignSelf="flex-start" onClick={() => patch({ pointsRows: [...draft.pointsRows, { label: '', points: '' }] })}>
            Add points row
          </Button>
          <Input placeholder="ZwiftPower league link" value={draft.leagueUrl} onChange={(e) => patch({ leagueUrl: e.target.value })} {...field} />
          <Heading size="sm" color="white">Discord</Heading>
          <Input
            type="password"
            placeholder={draft.discordWebhookSet ? 'Webhook saved. Enter a new one to replace it.' : 'Discord webhook'}
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            {...field}
          />
          {draft.discordWebhookSet ? (
            <Flex align="center" gap={3}>
              <Switch colorScheme="red" isChecked={clearWebhook} onChange={(e) => setClearWebhook(e.target.checked)} />
              <Text color="white">Remove the saved webhook</Text>
            </Flex>
          ) : null}
          {draft.kind === 'weekly' ? (
            <Input type="date" value={draft.anchorDate} onChange={(e) => patch({ anchorDate: e.target.value })} {...field} />
          ) : (
            <Stack spacing={2}>
              <Heading size="sm" color="white">Races</Heading>
              {draft.races.map((race, index) => (
                <Flex key={`${race.date}-${index}`} gap={2} wrap="wrap">
                  <Input type="date" value={race.date} onChange={(e) => updateRace(index, { date: e.target.value })} {...field} />
                  <Select value={race.route} onChange={(e) => updateRace(index, { route: e.target.value })} {...field}>
                    <option value="">Route</option>
                    {routes.map((route) => (
                      <option key={route.route} value={route.route}>{route.route}</option>
                    ))}
                  </Select>
                  <Input placeholder="Stage name" value={race.label} onChange={(e) => updateRace(index, { label: e.target.value })} {...field} />
                  <Input placeholder="Extra Zwift words" value={race.match} onChange={(e) => updateRace(index, { match: e.target.value })} {...field} />
                  <Button onClick={() => patch({ races: draft.races.filter((_, raceIndex) => raceIndex !== index) })}>Remove</Button>
                </Flex>
              ))}
              <Button
                alignSelf="flex-start"
                onClick={() => patch({ races: [...draft.races, { date: '', route: routes[0]?.route || '', label: '', match: '', starts: [] }] })}
              >
                Add race
              </Button>
            </Stack>
          )}
          <Flex gap={2} wrap="wrap">
            <Button colorScheme="red" isLoading={busy === 'save'} onClick={() => void save()}>Save series</Button>
            {draft.slug ? (
              <Button as={Link} href={`/admin/events/routes?series=${encodeURIComponent(draft.slug)}`}>
                Edit routes
              </Button>
            ) : null}
          </Flex>
          {draft.slug && draft.kind === 'weekly' ? (
            <Stack spacing={2}>
              <Heading size="sm" color="white">Coming weeks</Heading>
              {routes.length ? null : <Text color="gray.400">Add a route before the weeks can be filled in.</Text>}
              {schedule.map((row) => (
                <Flex key={row.date} gap={2} wrap="wrap" align="center">
                  <Text color="white" minW="140px">{row.date}</Text>
                  <Select value={row.routeName} onChange={(e) => void changeWeek(row.date, e.target.value)} {...field}>
                    {routes.map((route) => (
                      <option key={route.route} value={route.route}>{route.route}</option>
                    ))}
                  </Select>
                  <Button
                    colorScheme="red"
                    size="sm"
                    isLoading={busy === `apply:${row.date}:${row.routeName}`}
                    onClick={() => void apply(row.date, row.routeName)}
                  >
                    Apply
                  </Button>
                  {row.starts.length ? <Text color="gray.400">{row.starts.map((start) => start.eventId).join(', ')}</Text> : null}
                </Flex>
              ))}
            </Stack>
          ) : null}
          {draft.slug && draft.kind === 'limited' ? (
            <Stack spacing={2}>
              {draft.races.map((race) => (
                <Flex key={`${race.date}-${race.route}-${race.label}`} gap={2} align="center">
                  <Text color="white">{race.date} · {race.label || race.route}</Text>
                  <Button
                    colorScheme="red"
                    size="sm"
                    isDisabled={!race.date || !race.route}
                    isLoading={busy === `apply:${race.date}:${race.route}`}
                    onClick={() => void apply(race.date, race.route)}
                  >
                    Apply
                  </Button>
                </Flex>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Flex>
    </AdminShell>
  )
}
