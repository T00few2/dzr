'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Switch,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'

type Spec = { group: string; path: string; label: string; help?: string; type: 'boolean' | 'number' | 'channel'; min?: number; max?: number; step?: number }
type SettingsData = {
  specs: Spec[]
  defaults: Record<string, unknown>
  values: Record<string, unknown>
  paused: boolean
  published: Array<{ at: string | null; kind: string; key: string; channelId: string }>
  openDrafts: Array<{ id: string; kind: string; status: string; createdAt: string | null }>
  channels: Array<{ id: string; name: string }>
}
type Feature = { key: string; name: string; description: string; usedLast30Days: number | null; excluded: boolean; lastSpotlightedAt: string | null }
type Shipped = { slug: string; title: string; pitch: string; at: string | null; spotlightedAt: string | null; dismissed: boolean }

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : '—'
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || 'Request failed')
  return json
}

export default function AnnouncerAdminPage() {
  const toast = useToast()
  const [data, setData] = useState<SettingsData | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [features, setFeatures] = useState<Feature[]>([])
  const [shipped, setShipped] = useState<Shipped[]>([])
  const [detectedAt, setDetectedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [settings, featureData] = await Promise.all([
        send('/api/admin/announcer/settings', 'GET'),
        send('/api/admin/announcer/features', 'GET'),
      ])
      setData(settings)
      setForm(settings.values)
      setFeatures(featureData.features)
      setShipped(featureData.shipped)
      setDetectedAt(featureData.detectedAt)
    } catch (err: any) {
      setError(err?.message || 'Failed to load')
    }
  }

  async function run(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label)
    try {
      await action()
      toast({ title: success, status: 'success' })
      await load()
      return true
    } catch (err: any) {
      toast({ title: err?.message || 'Failed', status: 'error' })
      return false
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const groups = useMemo(() => {
    const out: Array<[string, Spec[]]> = []
    for (const spec of data?.specs || []) {
      const group = out.find(([name]) => name === spec.group)
      if (group) group[1].push(spec)
      else out.push([spec.group, [spec]])
    }
    return out
  }, [data])

  const dirty = data ? Object.keys(form).some((path) => form[path] !== data.values[path]) : false
  const channelName = (id: string) => data?.channels.find((c) => c.id === id)?.name || id

  function field(spec: Spec) {
    const value = form[spec.path]
    const isDefault = data ? value === data.defaults[spec.path] : true
    const set = (next: unknown) => setForm((prev) => ({ ...prev, [spec.path]: next }))
    const defaultText = spec.type === 'channel' ? `#${channelName(String(data?.defaults[spec.path]))}` : String(data?.defaults[spec.path])
    return (
      <FormControl key={spec.path}>
        <FormLabel fontSize="sm" mb={1}>
          {spec.label} {!isDefault ? <Badge colorScheme="purple" ml={1}>changed</Badge> : null}
        </FormLabel>
        {spec.type === 'boolean' ? (
          <Switch isChecked={value === true} onChange={(e) => set(e.target.checked)} colorScheme="red" />
        ) : spec.type === 'channel' ? (
          <Select value={String(value || '')} onChange={(e) => set(e.target.value)} bg="gray.900">
            {!data?.channels.some((c) => c.id === value) ? <option value={String(value || '')}>{String(value || '')}</option> : null}
            {data?.channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </Select>
        ) : (
          <Input type="number" value={value === undefined ? '' : String(value)} min={spec.min} max={spec.max} step={spec.step || 1}
            onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} bg="gray.900" />
        )}
        <FormHelperText color="gray.500">
          {spec.help ? `${spec.help} ` : ''}Default: {spec.type === 'boolean' ? (data?.defaults[spec.path] ? 'on' : 'off') : defaultText}
        </FormHelperText>
      </FormControl>
    )
  }

  return (
    <AdminShell title="Announcer">
      <Text color="gray.400" mb={4}>
        What the club bot posts on its own and the DM reminders it sends. Moderators approve every post in Discord before it goes
        out. Changes reach the bot within 5 minutes. The reminder texts are on the Onboarding page.
      </Text>
      {error ? <Text color="red.300" mb={4}>{error}</Text> : null}

      {data ? (
        <>
          <HStack spacing={4} mb={6} align="center" flexWrap="wrap">
            <Badge colorScheme={data.paused ? 'yellow' : 'green'} fontSize="md" px={2}>{data.paused ? 'Paused' : 'Running'}</Badge>
            <Button size="sm" onClick={() => run('pause', () => send('/api/admin/announcer/settings', 'PATCH', { paused: !data.paused }), data.paused ? 'Resumed' : 'Paused')} isLoading={busy === 'pause'}>
              {data.paused ? 'Resume posts and reminders' : 'Pause posts and reminders'}
            </Button>
            <Text color="gray.400">Open drafts: {data.openDrafts.length}</Text>
          </HStack>

          <Heading size="md" mb={2}>Recent bot posts</Heading>
          <Box mb={8}>
            {data.published.length ? data.published.map((row, i) => (
              <Text key={i} color="gray.300">{fmtTime(row.at)} · {row.kind} · #{channelName(row.channelId)}</Text>
            )) : <Text color="gray.500">No bot posts yet.</Text>}
          </Box>

          <HStack justify="space-between" mb={3}>
            <Heading size="md">Settings</Heading>
            <HStack>
              <Button size="sm" variant="ghost" onClick={() => setForm(data.values)} isDisabled={!dirty}>Undo changes</Button>
              <Button size="sm" colorScheme="red" isDisabled={!dirty} isLoading={busy === 'settings'}
                onClick={() => run('settings', () => send('/api/admin/announcer/settings', 'PUT', { values: form }), 'Settings saved')}>
                Save settings
              </Button>
            </HStack>
          </HStack>
          <VStack align="stretch" spacing={6} mb={10}>
            {groups.map(([group, specs]) => (
              <Box key={group} borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
                <Heading size="sm" mb={3}>{group}</Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>{specs.map(field)}</SimpleGrid>
              </Box>
            ))}
          </VStack>
        </>
      ) : null}

      <Heading size="md" mb={1}>Feature spotlight</Heading>
      <Text color="gray.400" mb={3}>
        The bot finds these itself, from its own slash commands and the things members can ask it, using the descriptions in
        the code. Nothing here needs writing or updating. It spotlights the one featured longest ago, and among those the one
        members use least. Switch off anything that should never be promoted.
        {detectedAt ? ` Last detected ${fmtTime(detectedAt)}.` : ' The list appears once the updated bot has started.'}
      </Text>
      <VStack align="stretch" spacing={2} mb={8}>
        {features.map((f) => (
          <HStack key={f.key} borderWidth="1px" borderColor="gray.700" rounded="md" p={3} justify="space-between" align="start" opacity={f.excluded ? 0.6 : 1}>
            <Box>
              <HStack mb={1}>
                <Text fontWeight="bold">{f.name}</Text>
                {f.usedLast30Days != null ? <Badge>{f.usedLast30Days} uses in DMs (30 days)</Badge> : null}
                {f.lastSpotlightedAt ? <Badge colorScheme="green">Spotlighted {fmtTime(f.lastSpotlightedAt)}</Badge> : null}
              </HStack>
              <Text fontSize="sm" color="gray.400" noOfLines={2}>{f.description}</Text>
            </Box>
            <Switch isChecked={!f.excluded} colorScheme="red" flexShrink={0} mt={1}
              onChange={(e) => run(`toggle-${f.key}`, () => send('/api/admin/announcer/features', 'PUT', { key: f.key, excluded: !e.target.checked }), e.target.checked ? 'Back in the spotlight' : 'Left out of the spotlight')} />
          </HStack>
        ))}
      </VStack>

      <Heading size="md" mb={1}>New features from the commit log</Heading>
      <Text color="gray.400" mb={3}>
        Features the bot announced as news. Each gets one spotlight about a month later. Skip one that should not be spotlighted.
      </Text>
      <VStack align="stretch" spacing={2}>
        {shipped.map((f) => (
          <HStack key={f.slug} borderWidth="1px" borderColor="gray.700" rounded="md" p={3} justify="space-between" align="start" opacity={f.dismissed ? 0.6 : 1}>
            <Box>
              <HStack mb={1}>
                <Text fontWeight="bold">{f.title}</Text>
                {f.dismissed ? <Badge>Skipped</Badge> : f.spotlightedAt ? <Badge colorScheme="green">Spotlighted {fmtTime(f.spotlightedAt)}</Badge> : <Badge colorScheme="blue">Announced {fmtTime(f.at)}</Badge>}
              </HStack>
              <Text fontSize="sm" color="gray.400">{f.pitch}</Text>
            </Box>
            <Button size="xs" variant="ghost" flexShrink={0} isLoading={busy === `skip-${f.slug}`}
              onClick={() => run(`skip-${f.slug}`, () => send('/api/admin/announcer/features', 'PATCH', { slug: f.slug, dismissed: !f.dismissed }), f.dismissed ? 'Back in the rotation' : 'Skipped')}>
              {f.dismissed ? 'Undo skip' : 'Skip'}
            </Button>
          </HStack>
        ))}
        {!shipped.length ? <Text color="gray.500">None yet. They appear after the bot posts its first feature news.</Text> : null}
      </VStack>
    </AdminShell>
  )
}
