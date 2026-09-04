'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import type { CoachInjury, CoachProfile, CoachWeeklySlot } from '@/app/lib/coachProfile'
import type { CoachChatNote } from '@/app/lib/coachChatNotes'

const SPORT_OPTIONS = ['cycling', 'running', 'swimming', 'strength']
const DAYS: Array<{ id: string; label: string }> = [
  { id: 'mon', label: 'Man' },
  { id: 'tue', label: 'Tir' },
  { id: 'wed', label: 'Ons' },
  { id: 'thu', label: 'Tor' },
  { id: 'fri', label: 'Fre' },
  { id: 'sat', label: 'Lør' },
  { id: 'sun', label: 'Søn' },
]

const secondaryButtonProps = {
  variant: 'outline' as const,
  color: 'gray.100',
  borderColor: 'gray.500',
  bg: 'gray.800',
  _hover: { bg: 'gray.700', borderColor: 'gray.400', color: 'white' },
}

type ClearConfirm =
  | { kind: 'memory' }
  | { kind: 'notes' }
  | { kind: 'all' }
  | { kind: 'note'; id: string }

const CLEAR_CONFIRM_COPY = {
  memory: {
    title: 'Clear memory?',
    body: 'Coach-profilen nulstilles til udgangspunktet. Chat-noter slettes ikke.',
    confirm: 'Clear memory',
  },
  notes: {
    title: 'Clear notes?',
    body: 'Alle chat-noter slettes. Coach-profilen beholdes.',
    confirm: 'Clear notes',
  },
  all: {
    title: 'Clear all?',
    body: 'Coach-profilen nulstilles, og alle chat-noter slettes. Det kan ikke fortrydes.',
    confirm: 'Clear all',
  },
  note: {
    title: 'Slet note?',
    body: 'Denne chat-note slettes. Det kan ikke fortrydes.',
    confirm: 'Slet',
  },
} as const

function emptyForm(): CoachProfile {
  return {
    ridesPerWeek: null,
    sports: [],
    weekly: [],
    injuries: [],
    goals: [],
    notes: '',
    style: { length: null, language: null, tone: null, notes: '' },
    notesOptIn: false,
  }
}

export default function CoachMemoryEditor() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [form, setForm] = useState<CoachProfile>(emptyForm())
  const [chatNotes, setChatNotes] = useState<CoachChatNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [extraSport, setExtraSport] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [ridesMin, setRidesMin] = useState('')
  const [ridesMax, setRidesMax] = useState('')
  const [clearConfirm, setClearConfirm] = useState<ClearConfirm | null>(null)
  const cancelClearRef = useRef<HTMLButtonElement>(null)

  function applyProfile(profile: CoachProfile) {
    setForm({
      ...emptyForm(),
      ...profile,
      sports: profile.sports || [],
      weekly: profile.weekly || [],
      injuries: profile.injuries || [],
      goals: profile.goals || [],
      style: profile.style || { length: null, language: null, tone: null, notes: '' },
      notesOptIn: profile.notesOptIn === true,
    })
    setRidesMin(profile.ridesPerWeek?.min != null ? String(profile.ridesPerWeek.min) : '')
    setRidesMax(profile.ridesPerWeek?.max != null ? String(profile.ridesPerWeek.max) : '')
  }

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const [profileRes, notesRes] = await Promise.all([
          fetch('/api/coach/profile', { cache: 'no-store' }),
          fetch('/api/coach/notes', { cache: 'no-store' }),
        ])
        if (profileRes.status === 401) {
          if (!ignore) setEligible(false)
          return
        }
        const data = await profileRes.json()
        if (ignore) return
        setEligible(data?.eligible !== false)
        if (data?.profile) applyProfile(data.profile)
        if (notesRes.ok) {
          const notesData = await notesRes.json().catch(() => ({}))
          if (!ignore && Array.isArray(notesData?.notes)) setChatNotes(notesData.notes)
        }
      } catch {
        if (!ignore) setEligible(false)
      } finally {
        if (!ignore) {
          setLoading(false)
          setNotesLoading(false)
        }
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  function toggleSport(sport: string) {
    setForm((prev) => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter((s) => s !== sport)
        : [...prev.sports, sport],
    }))
  }

  function addExtraSport() {
    const value = extraSport.trim().toLowerCase()
    if (!value) return
    setForm((prev) => ({
      ...prev,
      sports: prev.sports.includes(value) ? prev.sports : [...prev.sports, value],
    }))
    setExtraSport('')
  }

  function updateWeekly(index: number, next: CoachWeeklySlot) {
    setForm((prev) => ({
      ...prev,
      weekly: prev.weekly.map((row, i) => (i === index ? next : row)),
    }))
  }

  function addWeekly() {
    setForm((prev) => ({
      ...prev,
      weekly: [...prev.weekly, { sport: 'strength', days: [] }],
    }))
  }

  function addInjury() {
    setForm((prev) => ({
      ...prev,
      injuries: [
        ...prev.injuries,
        { id: `new_${Date.now()}`, text: '', started: '', status: 'active', source: 'user' },
      ],
    }))
  }

  function updateInjury(index: number, next: CoachInjury) {
    setForm((prev) => ({
      ...prev,
      injuries: prev.injuries.map((row, i) => (i === index ? next : row)),
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const min = ridesMin.trim() === '' ? null : Number(ridesMin)
      const max = ridesMax.trim() === '' ? null : Number(ridesMax)
      const payload: CoachProfile = {
        ...form,
        ridesPerWeek: min == null && max == null ? null : {
          ...(min != null && Number.isFinite(min) ? { min } : {}),
          ...(max != null && Number.isFinite(max) ? { max } : {}),
        },
        injuries: form.injuries.filter((inj) => inj.text.trim()),
        weekly: form.weekly.filter((row) => row.sport.trim() && row.days.length),
        goals: form.goals.map((g) => g.trim()).filter(Boolean),
        notesOptIn: form.notesOptIn === true,
      }
      const res = await fetch('/api/coach/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Could not save', status: 'error' })
        return
      }
      if (data?.profile) applyProfile(data.profile)
      toast({ title: 'Coach memory saved', status: 'success' })
    } finally {
      setSaving(false)
    }
  }

  async function resetMemoryRequest() {
    const res = await fetch('/api/coach/profile', { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Could not reset memory')
    }
    applyProfile(data?.profile || emptyForm())
  }

  async function deleteAllNotesRequest() {
    const res = await fetch('/api/coach/notes?all=1', { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Could not delete notes')
    }
    setChatNotes([])
  }

  async function clearMemory() {
    setSaving(true)
    try {
      await resetMemoryRequest()
      toast({ title: 'Coach-profilen er nulstillet', status: 'info' })
    } catch (err: any) {
      toast({ title: err?.message || 'Could not reset memory', status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function clearNotes() {
    setSaving(true)
    try {
      await deleteAllNotesRequest()
      toast({ title: 'Chat-noter slettet', status: 'info' })
    } catch (err: any) {
      toast({ title: err?.message || 'Could not delete notes', status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function clearAll() {
    setSaving(true)
    try {
      const results = await Promise.allSettled([resetMemoryRequest(), deleteAllNotesRequest()])
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      if (failed) {
        toast({
          title: failed.reason?.message || 'Could not clear everything',
          status: 'error',
        })
        return
      }
      toast({ title: 'Profil og chat-noter er nulstillet', status: 'info' })
    } finally {
      setSaving(false)
    }
  }

  function formatNoteAt(at: string | null) {
    if (!at) return ''
    const date = new Date(at)
    if (Number.isNaN(date.getTime())) return at.slice(0, 10)
    return date.toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })
  }

  async function deleteChatNote(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/coach/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Could not delete note', status: 'error' })
        return
      }
      setChatNotes(Array.isArray(data?.notes) ? data.notes : [])
    } finally {
      setSaving(false)
    }
  }

  async function confirmClear() {
    const action = clearConfirm
    if (!action) return
    if (action.kind === 'memory') await clearMemory()
    else if (action.kind === 'notes') await clearNotes()
    else if (action.kind === 'all') await clearAll()
    else await deleteChatNote(action.id)
    setClearConfirm(null)
  }

  if (loading) {
    return (
      <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
        <Heading size="sm" mb={2}>DZR Coach memory</Heading>
        <Spinner size="sm" />
      </Box>
    )
  }

  if (eligible === false) {
    return (
      <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
        <Heading size="sm" mb={2}>DZR Coach memory</Heading>
        <Text color="gray.400" fontSize="sm">
          Coaching-memory er kun for betalende klubmedlemmer. Forny medlemskab under Membership.
        </Text>
      </Box>
    )
  }

  return (
    <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
      <Heading size="sm" mb={2}>DZR Coach memory</Heading>
      <Text color="gray.400" mb={4} fontSize="sm">
        Her sætter du dine faste rammer til DZR Coach: hvor ofte du kører, andre sportsgrene, skader, mål og hvordan coachen skal svare. Du har fået et udgangspunkt, som du kan rette. Coachen ændrer ikke selv de rammer — det gør du her. Data bruges kun til din private coaching og sendes til OpenAI, når du chatter med coachen. Det gemmes krypteret.
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
        <FormControl>
          <FormLabel>Rides per week (min)</FormLabel>
          <Input
            type="number"
            min={0}
            max={14}
            value={ridesMin}
            onChange={(e) => setRidesMin(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
          />
        </FormControl>
        <FormControl>
          <FormLabel>Rides per week (max)</FormLabel>
          <Input
            type="number"
            min={0}
            max={14}
            value={ridesMax}
            onChange={(e) => setRidesMax(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
          />
        </FormControl>
      </SimpleGrid>

      <FormControl mb={4}>
        <FormLabel>Sports</FormLabel>
        <HStack spacing={4} wrap="wrap">
          {SPORT_OPTIONS.map((sport) => (
            <Checkbox
              key={sport}
              isChecked={form.sports.includes(sport)}
              onChange={() => toggleSport(sport)}
              colorScheme="red"
              textTransform="capitalize"
            >
              {sport}
            </Checkbox>
          ))}
        </HStack>
        <HStack mt={2} maxW="360px">
          <Input
            placeholder="Other sport"
            value={extraSport}
            onChange={(e) => setExtraSport(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
            size="sm"
          />
          <Button size="sm" onClick={addExtraSport} {...secondaryButtonProps}>Add</Button>
        </HStack>
        {form.sports.filter((s) => !SPORT_OPTIONS.includes(s)).length > 0 && (
          <Text mt={2} fontSize="sm" color="gray.400">
            Extra: {form.sports.filter((s) => !SPORT_OPTIONS.includes(s)).join(', ')}
          </Text>
        )}
      </FormControl>

      <Box mb={4}>
        <Flex justify="space-between" align="center" mb={2}>
          <FormLabel mb={0}>Fixed weekly slots</FormLabel>
          <Button size="xs" onClick={addWeekly} {...secondaryButtonProps}>Add slot</Button>
        </Flex>
        <Stack spacing={3}>
          {form.weekly.map((row, index) => (
            <Box key={`${row.sport}-${index}`} borderWidth="1px" borderColor="gray.700" borderRadius="md" p={3}>
              <HStack align="flex-start" spacing={3} wrap="wrap">
                <Select
                  value={row.sport}
                  onChange={(e) => updateWeekly(index, { ...row, sport: e.target.value })}
                  maxW="180px"
                  bg="gray.800"
                  borderColor="gray.600"
                  size="sm"
                >
                  {SPORT_OPTIONS.map((sport) => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                  {row.sport && !SPORT_OPTIONS.includes(row.sport) && (
                    <option value={row.sport}>{row.sport}</option>
                  )}
                </Select>
                <HStack wrap="wrap" spacing={3}>
                  {DAYS.map((day) => (
                    <Checkbox
                      key={day.id}
                      isChecked={row.days.includes(day.id)}
                      onChange={() => {
                        const days = row.days.includes(day.id)
                          ? row.days.filter((d) => d !== day.id)
                          : [...row.days, day.id]
                        updateWeekly(index, { ...row, days })
                      }}
                      colorScheme="red"
                      size="sm"
                    >
                      {day.label}
                    </Checkbox>
                  ))}
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  color="red.300"
                  _hover={{ bg: 'whiteAlpha.100', color: 'red.200' }}
                  onClick={() => setForm((prev) => ({ ...prev, weekly: prev.weekly.filter((_, i) => i !== index) }))}
                >
                  Delete
                </Button>
              </HStack>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box mb={4}>
        <Flex justify="space-between" align="center" mb={2}>
          <FormLabel mb={0}>Injuries / limits</FormLabel>
          <Button size="xs" onClick={addInjury} {...secondaryButtonProps}>Add</Button>
        </Flex>
        <Stack spacing={3}>
          {form.injuries.map((inj, index) => (
            <SimpleGrid key={inj.id || index} columns={{ base: 1, md: 4 }} spacing={2} alignItems="end">
              <Input
                placeholder="e.g. knee"
                value={inj.text}
                onChange={(e) => updateInjury(index, { ...inj, text: e.target.value })}
                bg="gray.800"
                borderColor="gray.600"
                size="sm"
              />
              <Input
                placeholder="Started (optional)"
                value={inj.started || ''}
                onChange={(e) => updateInjury(index, { ...inj, started: e.target.value })}
                bg="gray.800"
                borderColor="gray.600"
                size="sm"
              />
              <Select
                value={inj.status}
                onChange={(e) => updateInjury(index, { ...inj, status: e.target.value === 'recovered' ? 'recovered' : 'active' })}
                bg="gray.800"
                borderColor="gray.600"
                size="sm"
              >
                <option value="active">Active</option>
                <option value="recovered">Recovered</option>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                color="red.300"
                _hover={{ bg: 'whiteAlpha.100', color: 'red.200' }}
                onClick={() => setForm((prev) => ({ ...prev, injuries: prev.injuries.filter((_, i) => i !== index) }))}
              >
                Delete
              </Button>
            </SimpleGrid>
          ))}
        </Stack>
      </Box>

      <Box mb={4}>
        <FormLabel>Goals</FormLabel>
        <Stack spacing={2} mb={2}>
          {form.goals.map((goal, index) => (
            <HStack key={`${goal}-${index}`}>
              <Input
                value={goal}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  goals: prev.goals.map((g, i) => (i === index ? e.target.value : g)),
                }))}
                bg="gray.800"
                borderColor="gray.600"
                size="sm"
              />
              <Button
                size="sm"
                variant="ghost"
                color="red.300"
                _hover={{ bg: 'whiteAlpha.100', color: 'red.200' }}
                onClick={() => setForm((prev) => ({ ...prev, goals: prev.goals.filter((_, i) => i !== index) }))}
              >
                Delete
              </Button>
            </HStack>
          ))}
        </Stack>
        <HStack maxW="480px">
          <Input
            placeholder="Add a goal"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
            size="sm"
          />
          <Button
            size="sm"
            {...secondaryButtonProps}
            onClick={() => {
              const value = newGoal.trim()
              if (!value) return
              setForm((prev) => ({ ...prev, goals: [...prev.goals, value] }))
              setNewGoal('')
            }}
          >
            Add
          </Button>
        </HStack>
      </Box>

      <Heading size="xs" mb={3} color="gray.300">Coaching style</Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
        <FormControl>
          <FormLabel>Message length</FormLabel>
          <RadioGroup
            value={form.style.length || 'default'}
            onChange={(value) => setForm((prev) => ({
              ...prev,
              style: { ...prev.style, length: !value || value === 'default' ? null : value as CoachProfile['style']['length'] },
            }))}
          >
            <Stack>
              <Radio value="default" colorScheme="red">Default</Radio>
              <Radio value="short" colorScheme="red">Short messages</Radio>
              <Radio value="normal" colorScheme="red">Normal</Radio>
              <Radio value="detailed" colorScheme="red">Detailed</Radio>
            </Stack>
          </RadioGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Language</FormLabel>
          <RadioGroup
            value={form.style.language || 'default'}
            onChange={(value) => setForm((prev) => ({
              ...prev,
              style: { ...prev.style, language: !value || value === 'default' ? null : value as CoachProfile['style']['language'] },
            }))}
          >
            <Stack>
              <Radio value="default" colorScheme="red">Match chat</Radio>
              <Radio value="da" colorScheme="red">Danish</Radio>
              <Radio value="en" colorScheme="red">English</Radio>
            </Stack>
          </RadioGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Tone</FormLabel>
          <RadioGroup
            value={form.style.tone || 'default'}
            onChange={(value) => setForm((prev) => ({
              ...prev,
              style: { ...prev.style, tone: !value || value === 'default' ? null : value as CoachProfile['style']['tone'] },
            }))}
          >
            <Stack>
              <Radio value="default" colorScheme="red">Default</Radio>
              <Radio value="direct" colorScheme="red">Direct</Radio>
              <Radio value="encouraging" colorScheme="red">Encouraging</Radio>
              <Radio value="casual" colorScheme="red">Casual</Radio>
            </Stack>
          </RadioGroup>
        </FormControl>
      </SimpleGrid>
      <FormControl mb={6}>
        <FormLabel>Other style notes</FormLabel>
        <Input
          placeholder="e.g. bullets only, no emojis"
          value={form.style.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, style: { ...prev.style, notes: e.target.value } }))}
          bg="gray.800"
          borderColor="gray.600"
        />
      </FormControl>

      <Heading size="xs" mb={3} color="gray.300">Chat-noter</Heading>
      <Checkbox
        isChecked={form.notesOptIn === true}
        onChange={(e) => setForm((prev) => ({ ...prev, notesOptIn: e.target.checked }))}
        colorScheme="red"
        alignItems="flex-start"
        mb={3}
      >
        <Text color="gray.200" fontSize="sm">
          Gem korte, daterede notater fra mine coach-samtaler (fx at jeg var syg i går). Coachen bruger dem kun, når dette er slået til.
        </Text>
      </Checkbox>
      <Text color="gray.400" fontSize="sm" mb={3}>
        Noterne er ikke faste regler. Du kan se og slette dem her. Husk at trykke Save memory, når du slår det til eller fra.
      </Text>
      {notesLoading ? (
        <Spinner size="sm" mb={6} />
      ) : chatNotes.length === 0 ? (
        <Text color="gray.500" fontSize="sm" mb={6}>Ingen chat-noter endnu.</Text>
      ) : (
        <Stack spacing={3} mb={4}>
          {chatNotes.map((note) => (
            <Flex
              key={note.id}
              gap={3}
              align="flex-start"
              justify="space-between"
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.600"
              borderRadius="md"
              p={3}
            >
              <Box>
                <Text fontSize="xs" color="gray.500">{formatNoteAt(note.at)}</Text>
                <Text fontSize="sm" color="gray.100">{note.text}</Text>
              </Box>
              <Button
                size="xs"
                variant="ghost"
                color="red.300"
                _hover={{ bg: 'whiteAlpha.100', color: 'red.200' }}
                onClick={() => setClearConfirm({ kind: 'note', id: note.id })}
                isDisabled={saving}
              >
                Slet
              </Button>
            </Flex>
          ))}
        </Stack>
      )}

      <Flex wrap="wrap" gap={2}>
        <Button onClick={save} isLoading={saving} size="sm" bg="#ad1a2d" color="white" _hover={{ bg: '#8c1524' }}>
          Save memory
        </Button>
        <Button onClick={() => setClearConfirm({ kind: 'memory' })} isLoading={saving} size="sm" variant="outline" colorScheme="red" color="red.300" borderColor="red.400" _hover={{ bg: 'whiteAlpha.100' }}>
          Clear memory
        </Button>
        <Button onClick={() => setClearConfirm({ kind: 'notes' })} isLoading={saving} isDisabled={chatNotes.length === 0} size="sm" variant="outline" colorScheme="red" color="red.300" borderColor="red.400" _hover={{ bg: 'whiteAlpha.100' }}>
          Clear notes
        </Button>
        <Button onClick={() => setClearConfirm({ kind: 'all' })} isLoading={saving} size="sm" variant="outline" colorScheme="red" color="red.300" borderColor="red.400" _hover={{ bg: 'whiteAlpha.100' }}>
          Clear all
        </Button>
      </Flex>

      <AlertDialog
        isOpen={Boolean(clearConfirm)}
        leastDestructiveRef={cancelClearRef}
        onClose={() => {
          if (!saving) setClearConfirm(null)
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" color="gray.100" borderWidth="1px" borderColor="gray.600">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {clearConfirm ? CLEAR_CONFIRM_COPY[clearConfirm.kind].title : ''}
            </AlertDialogHeader>
            <AlertDialogBody>
              {clearConfirm ? CLEAR_CONFIRM_COPY[clearConfirm.kind].body : ''}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelClearRef}
                onClick={() => setClearConfirm(null)}
                isDisabled={saving}
                {...secondaryButtonProps}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                ml={3}
                size="sm"
                bg="#ad1a2d"
                color="white"
                _hover={{ bg: '#8c1524' }}
                onClick={confirmClear}
                isLoading={saving}
              >
                {clearConfirm ? CLEAR_CONFIRM_COPY[clearConfirm.kind].confirm : ''}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
