'use client'

import React, { useEffect, useState } from 'react'
import {
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
  Textarea,
  useToast,
} from '@chakra-ui/react'
import type { CoachInjury, CoachProfile, CoachWeeklySlot } from '@/app/lib/coachProfile'

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

function emptyForm(): CoachProfile {
  return {
    ridesPerWeek: null,
    sports: [],
    weekly: [],
    injuries: [],
    goals: [],
    notes: '',
    style: { length: null, language: null, tone: null, notes: '' },
  }
}

export default function CoachMemoryEditor() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [form, setForm] = useState<CoachProfile>(emptyForm())
  const [extraSport, setExtraSport] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [ridesMin, setRidesMin] = useState('')
  const [ridesMax, setRidesMax] = useState('')

  function applyProfile(profile: CoachProfile) {
    setForm({
      ...emptyForm(),
      ...profile,
      sports: profile.sports || [],
      weekly: profile.weekly || [],
      injuries: profile.injuries || [],
      goals: profile.goals || [],
      style: profile.style || { length: null, language: null, tone: null, notes: '' },
    })
    setRidesMin(profile.ridesPerWeek?.min != null ? String(profile.ridesPerWeek.min) : '')
    setRidesMax(profile.ridesPerWeek?.max != null ? String(profile.ridesPerWeek.max) : '')
  }

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const res = await fetch('/api/coach/profile', { cache: 'no-store' })
        if (res.status === 401) {
          if (!ignore) setEligible(false)
          return
        }
        const data = await res.json()
        if (ignore) return
        setEligible(data?.eligible !== false)
        if (data?.profile) applyProfile(data.profile)
      } catch {
        if (!ignore) setEligible(false)
      } finally {
        if (!ignore) setLoading(false)
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

  async function clearAll() {
    if (!window.confirm('Slet al DZR Coach memory?')) return
    setSaving(true)
    try {
      const res = await fetch('/api/coach/profile', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Could not delete', status: 'error' })
        return
      }
      applyProfile(data?.profile || emptyForm())
      toast({ title: 'Coach memory cleared', status: 'info' })
    } finally {
      setSaving(false)
    }
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
        Coach gemmer træningsrammer og skrivestil fra dine Discord-DMs og spørger ja/nej. Skader gemmes med dine egne ord, ikke som diagnose. Data bruges kun til din private coaching og sendes til OpenAI når du chatter med coachen. Her kan du rette eller slette det.
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
          <Button size="sm" onClick={addExtraSport} variant="outline">Add</Button>
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
          <Button size="xs" onClick={addWeekly} variant="outline">Add slot</Button>
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
                  colorScheme="red"
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
          <Button size="xs" onClick={addInjury} variant="outline">Add</Button>
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
                colorScheme="red"
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
                colorScheme="red"
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
            variant="outline"
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

      <FormControl mb={4}>
        <FormLabel>Notes</FormLabel>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          bg="gray.800"
          borderColor="gray.600"
          rows={3}
        />
      </FormControl>

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

      <HStack>
        <Button onClick={save} isLoading={saving} size="sm" bg="#ad1a2d" color="white" _hover={{ bg: '#8c1524' }}>
          Save memory
        </Button>
        <Button onClick={clearAll} isLoading={saving} size="sm" variant="outline" colorScheme="red">
          Clear all
        </Button>
      </HStack>
    </Box>
  )
}
