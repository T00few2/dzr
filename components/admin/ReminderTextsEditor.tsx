'use client'

import { useEffect, useState } from 'react'
import { Badge, Box, Button, Heading, HStack, Text, Textarea, useToast, VStack } from '@chakra-ui/react'

type Step = {
  step: string
  label: string
  defaultText: string
  text: string
  isCustom: boolean
  updatedAt: string | null
  updatedBy: string | null
}

/** View and change the texts of the bot's DM reminders. The bot picks up a change within 5 minutes. */
export default function ReminderTextsEditor() {
  const toast = useToast()
  const [steps, setSteps] = useState<Step[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [maxChars, setMaxChars] = useState(1800)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    const res = await fetch('/api/admin/announcer/reminders', { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body?.error || 'Failed to load reminder texts')
      return
    }
    setSteps(body.steps)
    setMaxChars(body.maxChars)
    setEnabled(body.enabled)
    setDrafts(Object.fromEntries(body.steps.map((s: Step) => [s.step, s.text])))
  }

  async function save(step: string, text: string) {
    setSaving(step)
    const res = await fetch('/api/admin/announcer/reminders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, text }),
    })
    const body = await res.json().catch(() => ({}))
    setSaving(null)
    toast({ title: res.ok ? (body.isCustom ? 'Saved' : 'Using the default text') : body.error || 'Save failed', status: res.ok ? 'success' : 'error' })
    if (res.ok) await load()
  }

  useEffect(() => {
    load().catch(() => setError('Failed to load reminder texts'))
  }, [])

  return (
    <Box mb={8}>
      <Heading size="md" mb={1}>DM reminder texts</Heading>
      <Text color="gray.400" mb={3}>
        The private reminders the bot sends members who are stuck on a step, when they are active on the server. Discord
        markdown works; write channels as {'<#channel id>'}. The bot uses a saved text within 5 minutes. Preview one in Discord
        with /announcer_preview_dm.
        {!enabled ? ' DM reminders are currently switched off.' : ''}
      </Text>
      {error ? <Text color="red.300" mb={3}>{error}</Text> : null}
      <VStack align="stretch" spacing={6}>
        {steps.map((s) => {
          const draft = drafts[s.step] ?? s.text
          const changed = draft.trim() !== s.text.trim()
          return (
            <Box key={s.step} borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Text fontWeight="bold">{s.label}</Text>
                  <Badge colorScheme={s.isCustom ? 'purple' : 'gray'}>{s.isCustom ? 'Custom' : 'Default'}</Badge>
                </HStack>
                {s.updatedAt ? (
                  <Text fontSize="sm" color="gray.500">
                    Changed {new Date(s.updatedAt).toLocaleString()}{s.updatedBy ? ` by ${s.updatedBy}` : ''}
                  </Text>
                ) : null}
              </HStack>
              <Textarea
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.step]: e.target.value }))}
                bg="gray.900"
                minH="200px"
                fontFamily="mono"
                fontSize="sm"
              />
              <HStack justify="space-between" mt={2}>
                <Text fontSize="sm" color={draft.length > maxChars ? 'red.300' : 'gray.500'}>{draft.length} / {maxChars}</Text>
                <HStack>
                  {s.isCustom ? (
                    <Button size="sm" variant="ghost" onClick={() => save(s.step, '')} isLoading={saving === s.step}>Reset to default</Button>
                  ) : null}
                  {changed ? (
                    <Button size="sm" variant="ghost" onClick={() => setDrafts((prev) => ({ ...prev, [s.step]: s.text }))}>Undo</Button>
                  ) : null}
                  <Button size="sm" colorScheme="red" onClick={() => save(s.step, draft)} isDisabled={!changed || draft.length > maxChars} isLoading={saving === s.step}>
                    Save
                  </Button>
                </HStack>
              </HStack>
            </Box>
          )
        })}
      </VStack>
    </Box>
  )
}
