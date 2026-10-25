'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { CoachProfile } from '@/app/lib/coachProfile'
import { coachSetupStep } from '@/packages/shared/coach/coachHowItWorks'
import { IntervalsPrivacyLink } from '@/components/IntervalsPrivacyModal'
import { INTERVALS_SETTINGS_URL } from '@/app/lib/intervalsCoachLinks'

const PREFACE_KEY = 'dzr-coach-setup-preface'
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAYS: Array<{ id: (typeof DAY_ORDER)[number]; label: string }> = [
  { id: 'mon', label: 'Man' },
  { id: 'tue', label: 'Tir' },
  { id: 'wed', label: 'Ons' },
  { id: 'thu', label: 'Tor' },
  { id: 'fri', label: 'Fre' },
  { id: 'sat', label: 'Lør' },
  { id: 'sun', label: 'Søn' },
]

type Screen = 'preface' | 'notes' | 'days' | 'calendar' | 'done' | 'hidden'
type CalendarKind = 'race' | 'session'

type SetupProfile = CoachProfile & {
  onboardingNotesSkippedAt: string | null
  onboardingWeeklySkippedAt: string | null
  onboardingCalendarSkippedAt: string | null
  onboardingFinishedAt: string | null
}

const primaryButtonProps = {
  size: 'lg' as const,
  flex: '1',
  bg: '#ad1a2d',
  color: 'white',
  _hover: { bg: '#8c1524' },
}

const secondaryButtonProps = {
  size: 'lg' as const,
  flex: '1',
  variant: 'outline' as const,
  color: 'gray.100',
  borderColor: 'gray.500',
  bg: 'transparent',
  _hover: { bg: 'gray.700', borderColor: 'gray.400', color: 'white' },
}

function copenhagenToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function prefaceSeen() {
  try {
    return sessionStorage.getItem(PREFACE_KEY) === '1'
  } catch {
    return false
  }
}

function markPrefaceSeen() {
  try {
    sessionStorage.setItem(PREFACE_KEY, '1')
  } catch {
    // Private mode can refuse storage. The preface then shows again on refresh, which is fine.
  }
}

function asSettings(profile: SetupProfile): CoachProfile {
  return {
    ridesPerWeek: profile.ridesPerWeek,
    sports: profile.sports || [],
    weekly: profile.weekly || [],
    injuries: profile.injuries || [],
    goals: [],
    style: profile.style || { length: null, language: null, tone: null, notes: '' },
    notesOptIn: profile.notesOptIn === true,
    followUpEveryDays: profile.followUpEveryDays ?? null,
  }
}

function firstOpen(profile: SetupProfile, hasCalendar: boolean) {
  return coachSetupStep(profile, { hasCalendarEntry: hasCalendar })
}

export default function CoachSetupFlow({
  mode,
  onProfileChange,
}: {
  /** landing: the page after intervals.icu connects. resume: Mine sider, until setup is done. */
  mode: 'landing' | 'resume'
  onProfileChange?: () => void
}) {
  const { status } = useSession()
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<SetupProfile | null>(null)
  const [hasCalendar, setHasCalendar] = useState(false)
  const [screen, setScreen] = useState<Screen | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<Record<string, boolean>>({})
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({})
  const [entryText, setEntryText] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [entryKind, setEntryKind] = useState<CalendarKind | null>(null)
  const finishing = useRef(false)

  useEffect(() => {
    if (mode !== 'landing' || status !== 'unauthenticated') return
    const current = window.location.pathname + window.location.search
    router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`)
  }, [mode, status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    let ignore = false
    async function load() {
      try {
        const [profileRes, calendarRes] = await Promise.all([
          fetch('/api/coach/profile', { cache: 'no-store' }),
          fetch('/api/calendar', { cache: 'no-store' }),
        ])
        if (profileRes.status === 401) {
          if (!ignore && mode === 'landing') {
            const current = window.location.pathname + window.location.search
            router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`)
          }
          return
        }
        const data = await profileRes.json().catch(() => ({}))
        if (ignore) return
        if (!profileRes.ok) {
          if (data?.eligible === false) {
            setEligible(false)
            setScreen(mode === 'landing' ? 'done' : 'hidden')
          } else {
            setLoadError('Kunne ikke hente opsætningen')
          }
          return
        }
        const isEligible = data?.eligible !== false
        setEligible(isEligible)
        const nextProfile = isEligible && data?.profile ? (data.profile as SetupProfile) : null
        setProfile(nextProfile)
        let calendar = false
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json().catch(() => ({}))
          calendar = Array.isArray(calendarData?.entries) && calendarData.entries.length > 0
        }
        if (ignore) return
        setHasCalendar(calendar)
        if (nextProfile) {
          const open = firstOpen(nextProfile, calendar)
          const finished = Boolean(nextProfile.onboardingFinishedAt) || open === 'done'
          if (finished) {
            setScreen(mode === 'landing' ? 'done' : 'hidden')
          } else if (mode === 'landing' && !prefaceSeen()) {
            setScreen('preface')
          } else {
            setScreen(open)
          }
        } else {
          setScreen(mode === 'landing' ? 'done' : 'hidden')
        }
      } catch {
        if (!ignore) setLoadError('Kunne ikke hente opsætningen')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [status, mode, router])

  useEffect(() => {
    if (finishing.current || !profile || profile.onboardingFinishedAt) return
    if (firstOpen(profile, hasCalendar) !== 'done') return
    finishing.current = true
    let ignore = false
    async function finish() {
      try {
        const res = await fetch('/api/coach/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboardingFinish: true, onboardingOnly: true }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          finishing.current = false
          return
        }
        if (!ignore && data?.profile) setProfile(data.profile as SetupProfile)
      } catch {
        finishing.current = false
      }
    }
    finish()
    return () => { ignore = true }
  }, [profile, hasCalendar])

  async function putProfile(settings: CoachProfile, extra: Record<string, unknown> = {}) {
    const res = await fetch('/api/coach/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme')
    return data.profile as SetupProfile
  }

  function goAfter(saved: SetupProfile, calendar: boolean) {
    const open = firstOpen(saved, calendar)
    setScreen(open === 'done' ? 'done' : open)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err: any) {
      const message = err?.message || 'Noget gik galt'
      setError(message)
      toast({ title: message, status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function enableNotes() {
    if (!profile) return
    await run(async () => {
      const saved = await putProfile({ ...asSettings(profile), notesOptIn: true })
      setProfile(saved)
      onProfileChange?.()
      goAfter(saved, hasCalendar)
    })
  }

  async function skip(which: 'notes' | 'weekly' | 'calendar') {
    if (!profile) return
    await run(async () => {
      const saved = await putProfile(asSettings(profile), { onboardingSkip: which })
      setProfile(saved)
      goAfter(saved, hasCalendar)
    })
  }

  async function saveDays() {
    if (!profile) return
    const days = DAY_ORDER
      .filter((id) => selectedDays[id])
      .map((id) => ({ day: id, startTime: dayTimes[id] || null }))
    if (!days.length) return
    await run(async () => {
      const sports = profile.sports.includes('cycling') ? profile.sports : [...profile.sports, 'cycling']
      const saved = await putProfile({
        ...asSettings(profile),
        sports,
        weekly: [{ sport: 'cycling', days }],
      })
      setProfile(saved)
      onProfileChange?.()
      goAfter(saved, hasCalendar)
    })
  }

  async function saveEntry() {
    if (!profile || !entryKind) return
    const text = entryText.trim()
    if (!text || !entryDate) return
    await run(async () => {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          eventDate: entryDate,
          startTime: null,
          kind: entryKind,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme')
      setHasCalendar(true)
      goAfter(profile, true)
    })
  }

  if (mode === 'resume' && status !== 'authenticated') return null
  if (mode === 'landing' && status === 'loading') {
    return (
      <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
        <Spinner size="sm" />
      </Container>
    )
  }
  if (mode === 'landing' && status === 'unauthenticated') return null

  if (loading) {
    if (mode === 'resume') {
      return (
        <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
          <Spinner size="sm" />
        </Box>
      )
    }
    return (
      <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
        <Spinner size="sm" />
      </Container>
    )
  }

  if (loadError) {
    if (mode === 'resume') return null
    return (
      <Frame mode={mode}>
        <Heading size="md" mb={3}>Opsætning</Heading>
        <Text color="gray.300">{loadError}</Text>
      </Frame>
    )
  }

  if (eligible === false) {
    if (mode === 'resume') return null
    return (
      <Frame mode={mode}>
        <Heading size="md" mb={3}>Coach</Heading>
        <Text color="gray.300">
          Coaching er kun for betalende klubmedlemmer. Forny medlemskab under Membership, eller gå til /join.
        </Text>
      </Frame>
    )
  }

  if (!profile || !screen || screen === 'hidden') return null

  const today = copenhagenToday()
  const maxDate = `${Number(today.slice(0, 4)) + 2}-12-31`
  const daysChosen = DAY_ORDER.some((id) => selectedDays[id])
  const entryReady = Boolean(entryText.trim() && entryDate && entryKind)

  let body: React.ReactNode = null
  if (screen === 'preface') {
    body = (
      <>
        <Heading size="md" mb={3}>Før coachen kan se dine ture</Heading>
        <Text color="gray.300" mb={4}>
          Tre ting på intervals.icu. Vi kan ikke tjekke dem herfra.
        </Text>
        <Stack spacing={2} color="gray.200" mb={6}>
          <Text>Forbind Zwift direkte, og slå upload af planlagte workouts til.</Text>
          <Text>Sæt den samme FTP på Zwift og på intervals.icu.</Text>
          <Text>
            <Box as="a" href={INTERVALS_SETTINGS_URL} target="_blank" rel="noreferrer" textDecoration="underline">
              Åbn intervals.icu settings
            </Box>
          </Text>
        </Stack>
        <ActionRow
          primary="Det er på plads"
          secondary="Jeg gør det senere"
          busy={busy}
          onPrimary={() => {
            markPrefaceSeen()
            setScreen(firstOpen(profile, hasCalendar))
          }}
          onSecondary={() => {
            markPrefaceSeen()
            setScreen(firstOpen(profile, hasCalendar))
          }}
        />
      </>
    )
  } else if (screen === 'notes') {
    body = (
      <>
        <StepLabel n={1} />
        <Heading size="md" mb={3}>Så coachen kan huske dig</Heading>
        <Text color="gray.300" mb={3}>
          Med chat-noter slået til husker coachen tråden fra gang til gang, og kan lægge noget i din kalender. Selve samtalen gemmes ikke.
        </Text>
        <Text fontSize="sm" color="gray.500" mb={6}>
          <IntervalsPrivacyLink>Hvad gemmes?</IntervalsPrivacyLink>
        </Text>
        <ActionRow
          primary="Slå chat-noter til"
          secondary="Ikke nu"
          busy={busy}
          onPrimary={enableNotes}
          onSecondary={() => skip('notes')}
        />
      </>
    )
  } else if (screen === 'days') {
    body = (
      <>
        <StepLabel n={2} />
        <Heading size="md" mb={3}>Hvornår kører du typisk?</Heading>
        <Text color="gray.300" mb={4}>
          Vælg dagene. Tid er valgfri, og den er dansk tid. Andre sportsgrene kan du sætte bagefter.
        </Text>
        <SimpleGrid columns={{ base: 4, sm: 7 }} spacing={2} mb={4}>
          {DAYS.map((day) => {
            const on = Boolean(selectedDays[day.id])
            return (
              <Button
                key={day.id}
                size="lg"
                minH="48px"
                variant={on ? 'solid' : 'outline'}
                bg={on ? '#ad1a2d' : 'transparent'}
                color="white"
                borderColor={on ? '#ad1a2d' : 'gray.500'}
                _hover={{ bg: on ? '#8c1524' : 'gray.700' }}
                aria-pressed={on}
                onClick={() => setSelectedDays((prev) => ({ ...prev, [day.id]: !prev[day.id] }))}
              >
                {day.label}
              </Button>
            )
          })}
        </SimpleGrid>
        {daysChosen && (
          <Stack spacing={2} mb={6}>
            {DAYS.filter((day) => selectedDays[day.id]).map((day) => (
              <HStack key={day.id} spacing={3}>
                <Text w="40px" color="gray.300" fontSize="sm">{day.label}</Text>
                <Input
                  type="time"
                  value={dayTimes[day.id] || ''}
                  aria-label={`Tid ${day.label}`}
                  onChange={(e) => setDayTimes((prev) => ({ ...prev, [day.id]: e.target.value }))}
                  bg="gray.800"
                  borderColor="gray.600"
                  maxW="160px"
                />
              </HStack>
            ))}
          </Stack>
        )}
        <ActionRow
          primary="Gem dage"
          secondary="Ingen faste dage"
          busy={busy}
          primaryDisabled={!daysChosen}
          onPrimary={saveDays}
          onSecondary={() => skip('weekly')}
        />
      </>
    )
  } else if (screen === 'calendar') {
    body = (
      <>
        <StepLabel n={3} />
        <Heading size="md" mb={3}>Har du et løb eller en plan?</Heading>
        <Text color="gray.300" mb={4}>
          Ét punkt er nok. Coachen kan se kalenderen og tage højde for den.
        </Text>
        <Stack spacing={3} mb={4}>
          <Input
            placeholder="fx klubmesterskab eller lang tur"
            value={entryText}
            onChange={(e) => setEntryText(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
            size="lg"
            maxLength={280}
          />
          <Input
            type="date"
            value={entryDate}
            min={today}
            max={maxDate}
            aria-label="Dato"
            onChange={(e) => setEntryDate(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
            size="lg"
          />
          <HStack spacing={2}>
            <KindButton selected={entryKind === 'race'} onClick={() => setEntryKind('race')}>Løb</KindButton>
            <KindButton selected={entryKind === 'session'} onClick={() => setEntryKind('session')}>Træning</KindButton>
          </HStack>
        </Stack>
        <Text fontSize="sm" color="gray.500" mb={6}>
          <Link href="/members-zone/calendar" style={{ textDecoration: 'underline' }}>
            Åbn kalenderen
          </Link>
        </Text>
        <ActionRow
          primary="Gem i kalenderen"
          secondary="Ikke lige nu"
          busy={busy}
          primaryDisabled={!entryReady}
          onPrimary={saveEntry}
          onSecondary={() => skip('calendar')}
        />
      </>
    )
  } else {
    body = (
      <>
        <Heading size="md" mb={3}>Du er klar</Heading>
        <Text color="gray.300" mb={4}>
          Skriv til DZR Coach i Discord. Spørg fx:
        </Text>
        <Box borderLeftWidth="3px" borderColor="#ad1a2d" pl={3} py={1} mb={6}>
          <Text color="white">Hvordan var min uge?</Text>
        </Box>
        <Text fontSize="sm" color="gray.500">
          {mode === 'resume'
            ? 'Skader, tone og check-in ligger i formularen herunder.'
            : (
              <>
                Skader, tone og check-in sætter du under{' '}
                <Link href="/members-zone/my-pages?tab=2" style={{ textDecoration: 'underline' }}>
                  Mine sider → Coach
                </Link>
                .
              </>
            )}
        </Text>
      </>
    )
  }

  return (
    <Frame mode={mode}>
      {body}
      {error && (
        <Text color="red.300" fontSize="sm" mt={4}>{error}</Text>
      )}
    </Frame>
  )
}

function Frame({ mode, children }: { mode: 'landing' | 'resume'; children: React.ReactNode }) {
  const card = (
    <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" p={{ base: 5, md: 8 }} bg="gray.900">
      {children}
    </Box>
  )
  if (mode === 'resume') return <Box mb={6}>{card}</Box>
  return (
    <Container maxW="lg" py={{ base: 10, md: 16 }} color="white">
      <Text color="gray.400" fontSize="sm" mb={3}>intervals.icu er forbundet</Text>
      {card}
    </Container>
  )
}

function StepLabel({ n }: { n: number }) {
  return (
    <Text color="gray.500" fontSize="sm" mb={2} letterSpacing="0.04em">
      Trin {n} af 3
    </Text>
  )
}

function ActionRow({
  primary,
  secondary,
  busy,
  primaryDisabled,
  onPrimary,
  onSecondary,
}: {
  primary: string
  secondary: string
  busy: boolean
  primaryDisabled?: boolean
  onPrimary: () => void
  onSecondary: () => void
}) {
  return (
    <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
      <Button {...primaryButtonProps} onClick={onPrimary} isLoading={busy} isDisabled={primaryDisabled}>
        {primary}
      </Button>
      <Button {...secondaryButtonProps} onClick={onSecondary} isDisabled={busy}>
        {secondary}
      </Button>
    </Stack>
  )
}

function KindButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      flex="1"
      size="lg"
      variant={selected ? 'solid' : 'outline'}
      bg={selected ? '#ad1a2d' : 'transparent'}
      color="white"
      borderColor={selected ? '#ad1a2d' : 'gray.500'}
      _hover={{ bg: selected ? '#8c1524' : 'gray.700' }}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
