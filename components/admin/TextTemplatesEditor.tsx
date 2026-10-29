'use client'

import { useEffect, useState } from 'react'
import { Badge, Box, Button, Code, Heading, HStack, Text, Textarea, useToast, VStack } from '@chakra-ui/react'

type Item = {
  key: string
  label: string
  placeholders: Record<string, string>
  defaultText: string
  text: string
  isCustom: boolean
  updatedAt: string | null
  updatedBy: string | null
}

/**
 * View and change a set of bot texts served by an admin text API (see app/api/admin/_lib/textTemplates.ts).
 * The bot picks up a change within 5 minutes.
 */
export default function TextTemplatesEditor({ apiPath, title, description, disabledNote }: {
  apiPath: string
  title: string
  description: string
  disabledNote?: string
}) {
  const toast = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [maxChars, setMaxChars] = useState(1800)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    const res = await fetch(apiPath, { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body?.error || 'Failed to load texts')
      return
    }
    setItems(body.items)
    setMaxChars(body.maxChars)
    setEnabled(body.enabled)
    setDrafts(Object.fromEntries(body.items.map((item: Item) => [item.key, item.text])))
  }

  async function save(key: string, text: string) {
    setSaving(key)
    const res = await fetch(apiPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, text }),
    })
    const body = await res.json().catch(() => ({}))
    setSaving(null)
    toast({ title: res.ok ? (body.isCustom ? 'Saved' : 'Using the default text') : body.error || 'Save failed', status: res.ok ? 'success' : 'error' })
    if (res.ok) await load()
  }

  useEffect(() => {
    load().catch(() => setError('Failed to load texts'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box mb={8}>
      <Heading size="md" mb={1}>{title}</Heading>
      <Text color="gray.400" mb={3}>
        {description} Discord markdown works; write channels as {'<#channel id>'}. The bot uses a saved text within 5 minutes.
        {!enabled && disabledNote ? ` ${disabledNote}` : ''}
      </Text>
      {error ? <Text color="red.300" mb={3}>{error}</Text> : null}
      <VStack align="stretch" spacing={6}>
        {items.map((item) => {
          const draft = drafts[item.key] ?? item.text
          const changed = draft.trim() !== item.text.trim()
          const placeholders = Object.entries(item.placeholders)
          return (
            <Box key={item.key} borderWidth="1px" borderColor="gray.700" rounded="md" p={4}>
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Text fontWeight="bold">{item.label}</Text>
                  <Badge colorScheme={item.isCustom ? 'purple' : 'gray'}>{item.isCustom ? 'Custom' : 'Default'}</Badge>
                </HStack>
                {item.updatedAt ? (
                  <Text fontSize="sm" color="gray.500">
                    Changed {new Date(item.updatedAt).toLocaleString()}{item.updatedBy ? ` by ${item.updatedBy}` : ''}
                  </Text>
                ) : null}
              </HStack>
              {placeholders.length ? (
                <Text fontSize="sm" color="gray.400" mb={2}>
                  Placeholders:{' '}
                  {placeholders.map(([name, help], i) => (
                    <span key={name}>{i ? ' · ' : ''}<Code>{`{${name}}`}</Code> {help}</span>
                  ))}
                  . A line whose placeholder has no value is left out.
                </Text>
              ) : null}
              <Textarea
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [item.key]: e.target.value }))}
                bg="gray.900"
                minH="160px"
                fontFamily="mono"
                fontSize="sm"
              />
              <HStack justify="space-between" mt={2}>
                <Text fontSize="sm" color={draft.length > maxChars ? 'red.300' : 'gray.500'}>{draft.length} / {maxChars}</Text>
                <HStack>
                  {item.isCustom ? (
                    <Button size="sm" variant="ghost" onClick={() => save(item.key, '')} isLoading={saving === item.key}>Reset to default</Button>
                  ) : null}
                  {changed ? (
                    <Button size="sm" variant="ghost" onClick={() => setDrafts((prev) => ({ ...prev, [item.key]: item.text }))}>Undo</Button>
                  ) : null}
                  <Button size="sm" colorScheme="red" onClick={() => save(item.key, draft)} isDisabled={!changed || draft.length > maxChars} isLoading={saving === item.key}>
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
