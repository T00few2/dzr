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
  Textarea,
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
type Feature = { key: string; title: string; pitch: string; howTo: string; links: string[]; enabled: boolean; isDefault: boolean; isChanged: boolean }
type Shipped = { slug: string; title: string; pitch: string; howTo: string; at: string | null; spotlightedAt: string | null; dismissed: boolean }

const EMPTY_FEATURE = { title: '', pitch: '', howTo: '', links: '' }

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : '—'
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || 'Request failed')
  return json
}

function FeatureEditor({ initial, onSave, onCancel, saving, withLinks = true }: {
  initial: { title: string; pitch: string; howTo: string; links: string }
  withLinks?: boolean
  onSave: (value: { title: string; pitch: string; howTo: string; links: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [value, setValue] = useState(initial)
  const set = (field: keyof typeof value) => (e: { target: { value: string } }) => setValue((prev) => ({ ...prev, [field]: e.target.value }))
  return (
    <VStack align="stretch" spacing={2} mt={2}>
      <Input placeholder="Title" value={value.title} onChange={set('title')} bg="gray.900" />
      <Textarea placeholder="What it is (pitch)" value={value.pitch} onChange={set('pitch')} bg="gray.900" />
      <Textarea placeholder="How to use it" value={value.howTo} onChange={set('howTo')} bg="gray.900" />
      {withLinks ? <Textarea placeholder="Links, one per line (website links or <#channel id>)" value={value.links} onChange={set('links')} bg="gray.900" minH="60px" /> : null}
      <HStack justify="flex-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" colorScheme="red" onClick={() => onSave(value)} isLoading={saving} isDisabled={!value.title.trim()}>Save</Button>
      </HStack>
    </VStack>
  )
}

export default function AnnouncerAdminPage() {
  const toast = useToast()
  const [data, setData] = useState<SettingsData | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [features, setFeatures] = useState<Feature[]>([])
  const [shipped, setShipped] = useState<Shipped[]>([])
  const [editing, setEditing] = useState<string | null>(null)
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

  const toFeatureBody = (value: { title: string; pitch: string; howTo: string; links: string }, enabled = true) => ({
    title: value.title, pitch: value.pitch, howTo: value.howTo, links: value.links.split('\n'), enabled,
  })

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
        The features the bot takes turns to promote, the one featured longest ago first. The bot writes each post from the title,
        pitch and how-to, so keep them factual. Switch a feature off to skip it.
      </Text>
      <VStack align="stretch" spacing={3} mb={4}>
        {features.map((f) => (
          <Box key={f.key} borderWidth="1px" borderColor="gray.700" rounded="md" p={3} opacity={f.enabled ? 1 : 0.6}>
            <HStack justify="space-between" align="start">
              <Box>
                <HStack mb={1}>
                  <Text fontWeight="bold">{f.title}</Text>
                  {!f.isDefault ? <Badge colorScheme="purple">Added</Badge> : f.isChanged ? <Badge colorScheme="purple">Changed</Badge> : null}
                </HStack>
                <Text fontSize="sm" color="gray.300">{f.pitch}</Text>
                <Text fontSize="sm" color="gray.500">{f.howTo}</Text>
                {f.links.length ? <Text fontSize="sm" color="gray.500">{f.links.join(' · ')}</Text> : null}
              </Box>
              <HStack flexShrink={0}>
                <Switch isChecked={f.enabled} colorScheme="red"
                  onChange={(e) => run(`toggle-${f.key}`, () => send('/api/admin/announcer/features', 'PUT', { key: f.key, feature: { ...f, enabled: e.target.checked } }), e.target.checked ? 'Feature on' : 'Feature off')} />
                <Button size="xs" onClick={() => setEditing(editing === f.key ? null : f.key)}>Edit</Button>
                {f.isChanged ? (
                  <Button size="xs" variant="ghost" isLoading={busy === `reset-${f.key}`}
                    onClick={() => run(`reset-${f.key}`, () => send(`/api/admin/announcer/features?key=${encodeURIComponent(f.key)}`, 'DELETE'), f.isDefault ? 'Reset to default' : 'Feature deleted')}>
                    {f.isDefault ? 'Reset' : 'Delete'}
                  </Button>
                ) : null}
              </HStack>
            </HStack>
            {editing === f.key ? (
              <FeatureEditor
                initial={{ title: f.title, pitch: f.pitch, howTo: f.howTo, links: f.links.join('\n') }}
                saving={busy === `save-${f.key}`}
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  if (await run(`save-${f.key}`, () => send('/api/admin/announcer/features', 'PUT', { key: f.key, feature: toFeatureBody(value, f.enabled) }), 'Feature saved')) setEditing(null)
                }}
              />
            ) : null}
          </Box>
        ))}
      </VStack>
      {editing === '__new' ? (
        <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={3} mb={8}>
          <Text fontWeight="bold">New feature</Text>
          <FeatureEditor
            initial={EMPTY_FEATURE}
            saving={busy === 'save-new'}
            onCancel={() => setEditing(null)}
            onSave={async (value) => {
              if (await run('save-new', () => send('/api/admin/announcer/features', 'PUT', { feature: toFeatureBody(value) }), 'Feature added')) setEditing(null)
            }}
          />
        </Box>
      ) : (
        <Button size="sm" mb={8} onClick={() => setEditing('__new')}>Add a feature</Button>
      )}

      <Heading size="md" mb={1}>New features from the commit log</Heading>
      <Text color="gray.400" mb={3}>
        Features the bot announced as news. Each gets one spotlight about a month later. Fix the text, or skip one that should not be spotlighted.
      </Text>
      <VStack align="stretch" spacing={3}>
        {shipped.map((f) => (
          <Box key={f.slug} borderWidth="1px" borderColor="gray.700" rounded="md" p={3} opacity={f.dismissed ? 0.6 : 1}>
            <HStack justify="space-between" align="start">
              <Box>
                <HStack mb={1}>
                  <Text fontWeight="bold">{f.title}</Text>
                  {f.dismissed ? <Badge>Skipped</Badge> : f.spotlightedAt ? <Badge colorScheme="green">Spotlighted {fmtTime(f.spotlightedAt)}</Badge> : <Badge colorScheme="blue">Announced {fmtTime(f.at)}</Badge>}
                </HStack>
                <Text fontSize="sm" color="gray.300">{f.pitch}</Text>
                <Text fontSize="sm" color="gray.500">{f.howTo}</Text>
              </Box>
              <HStack flexShrink={0}>
                <Button size="xs" onClick={() => setEditing(editing === `shipped-${f.slug}` ? null : `shipped-${f.slug}`)}>Edit</Button>
                <Button size="xs" variant="ghost" isLoading={busy === `skip-${f.slug}`}
                  onClick={() => run(`skip-${f.slug}`, () => send('/api/admin/announcer/features', 'PATCH', { slug: f.slug, dismissed: !f.dismissed }), f.dismissed ? 'Back in the rotation' : 'Skipped')}>
                  {f.dismissed ? 'Undo skip' : 'Skip'}
                </Button>
              </HStack>
            </HStack>
            {editing === `shipped-${f.slug}` ? (
              <FeatureEditor
                initial={{ title: f.title, pitch: f.pitch, howTo: f.howTo, links: '' }}
                withLinks={false}
                saving={busy === `save-${f.slug}`}
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  if (await run(`save-${f.slug}`, () => send('/api/admin/announcer/features', 'PATCH', { slug: f.slug, title: value.title, pitch: value.pitch, howTo: value.howTo }), 'Saved')) setEditing(null)
                }}
              />
            ) : null}
          </Box>
        ))}
        {!shipped.length ? <Text color="gray.500">None yet. They appear after the bot posts its first feature news.</Text> : null}
      </VStack>
    </AdminShell>
  )
}
