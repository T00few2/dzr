'use client'

import { useEffect, useState } from 'react'
import { Badge, Box, Button, Flex, Stack, Text } from '@chakra-ui/react'

type SavedEvent = {
  date: string
  label: string
  route: string
  eventId: string
  resultsFix: { at: string; updated: number; skipped: number } | null
  primesFix: { at: string; updated: number; skipped: number } | null
}

type CategoryChange = { name: string; zwid: string; from: string; to: string }
type SkippedRider = { name: string; zwid: string; reason: string }

type Preview = {
  eventId: number
  pending: boolean
  changes: CategoryChange[]
  skipped: SkippedRider[]
  updated?: CategoryChange[]
}

type SprintRow = { name: string; laps: string; segment: string; matched: boolean }
type SprintPreview = {
  eventId: number
  route: string
  pending: boolean
  points: string
  sprints: SprintRow[]
  updated?: SprintRow[]
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

export default function FiftyResults() {
  const [events, setEvents] = useState<SavedEvent[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [openId, setOpenId] = useState('')
  const [sprints, setSprints] = useState<SprintPreview | null>(null)
  const [sprintId, setSprintId] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const res = await fetch('/api/admin/events/results', { cache: 'no-store' })
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = await res.json()
    setEvents(Array.isArray(body.events) ? body.events : [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function check(eventId: string) {
    setBusy(`check:${eventId}`)
    setError('')
    setNotice('')
    setOpenId(eventId)
    const res = await fetch(`/api/admin/events/results/preview?eventId=${encodeURIComponent(eventId)}`)
    setBusy('')
    if (!res.ok) {
      setPreview(null)
      setError(await errorMessage(res))
      return
    }
    setPreview((await res.json()) as Preview)
  }

  async function update(eventId: string) {
    setBusy(`update:${eventId}`)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = (await res.json()) as Preview
    setPreview(body)
    const count = body.updated?.length || 0
    setNotice(count ? `Moved ${count} rider${count === 1 ? '' : 's'} off WKG.` : 'No WKG riders to move.')
    await load()
  }

  async function checkSprints(eventId: string) {
    setBusy(`sprints:${eventId}`)
    setError('')
    setNotice('')
    setSprintId(eventId)
    const res = await fetch(`/api/admin/events/results/sprints?eventId=${encodeURIComponent(eventId)}`)
    setBusy('')
    if (!res.ok) {
      setSprints(null)
      setError(await errorMessage(res))
      return
    }
    setSprints((await res.json()) as SprintPreview)
  }

  async function updateSprints(eventId: string) {
    setBusy(`apply-sprints:${eventId}`)
    setError('')
    setNotice('')
    const res = await fetch('/api/admin/events/results/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
    setBusy('')
    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    const body = (await res.json()) as SprintPreview
    setSprints(body)
    const count = body.updated?.length || 0
    setNotice(count ? `Set ${count} sprint${count === 1 ? '' : 's'} on ZwiftPower.` : 'No sprints to set.')
    await load()
  }

  return (
    <Box mt={6} pt={4} borderTopWidth="1px" borderColor="gray.700">
      <Text fontWeight="semibold" mb={1}>
        Results
      </Text>
      <Text color="gray.400" fontSize="sm" mb={3}>
        Saved races, newest first. Check categories moves WKG riders to the Unfiltered pen about two hours after the
        start. Check sprints fills the Primes tab from the route, about a day after Apply, once ZwiftPower has the
        event. A sprint name has to be the ZwiftPower segment name.
      </Text>
      {error ? (
        <Text color="red.300" mb={2}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text color="green.300" mb={2}>
          {notice}
        </Text>
      ) : null}
      <Stack spacing={3}>
        {events.map((event) => (
          <Box key={event.eventId}>
            <Flex gap={2} align="center" wrap="wrap">
              <Text minW="180px">{event.label}</Text>
              <Badge colorScheme="green">Event {event.eventId}</Badge>
              {event.resultsFix ? <Badge colorScheme="purple">Categories checked</Badge> : null}
              {event.primesFix ? <Badge colorScheme="blue">Sprints set</Badge> : null}
              <Button
                {...readableOutline}
                size="sm"
                isLoading={busy === `check:${event.eventId}`}
                onClick={() => void check(event.eventId)}
              >
                Check categories
              </Button>
              <Button
                {...readableOutline}
                size="sm"
                isLoading={busy === `sprints:${event.eventId}`}
                onClick={() => void checkSprints(event.eventId)}
              >
                Check sprints
              </Button>
            </Flex>
            {sprintId === event.eventId && sprints ? (
              <Box mt={2} pl={1}>
                {sprints.pending ? (
                  <Text color="orange.300">ZwiftPower does not have this event yet.</Text>
                ) : null}
                {!sprints.pending && !sprints.sprints.length ? <Text color="gray.400">This route has no sprints.</Text> : null}
                {sprints.sprints.map((sprint) => (
                  <Text key={`${sprint.name}-${sprint.laps}`} color={sprint.matched ? 'white' : 'orange.300'}>
                    {sprint.name}
                    {sprint.matched ? `: ${sprint.laps} lap${sprint.laps === '1' ? '' : 's'}, ${sprints.points}` : ' is not a ZwiftPower segment'}
                  </Text>
                ))}
                {sprints.sprints.length > 0 && sprints.sprints.every((sprint) => sprint.matched) ? (
                  <Button
                    colorScheme="red"
                    size="sm"
                    mt={2}
                    isLoading={busy === `apply-sprints:${event.eventId}`}
                    onClick={() => void updateSprints(event.eventId)}
                  >
                    Update sprints
                  </Button>
                ) : null}
              </Box>
            ) : null}
            {openId === event.eventId && preview ? (
              <Box mt={2} pl={1}>
                {preview.pending ? <Text color="orange.300">ZwiftPower does not have results for this race yet.</Text> : null}
                {!preview.pending && !preview.changes.length && !preview.skipped.length ? (
                  <Text color="gray.400">No WKG riders.</Text>
                ) : null}
                {preview.changes.map((change) => (
                  <Text key={change.zwid}>
                    {change.name}: {change.from} → {change.to}
                  </Text>
                ))}
                {preview.skipped.map((rider) => (
                  <Text key={rider.zwid || rider.name} color="orange.300">
                    {rider.name}: {rider.reason}
                  </Text>
                ))}
                {preview.changes.length ? (
                  <Button
                    colorScheme="red"
                    size="sm"
                    mt={2}
                    isLoading={busy === `update:${event.eventId}`}
                    onClick={() => void update(event.eventId)}
                  >
                    Update ZwiftPower
                  </Button>
                ) : null}
              </Box>
            ) : null}
          </Box>
        ))}
        {!events.length ? <Text color="gray.500">No saved races yet.</Text> : null}
      </Stack>
    </Box>
  )
}
