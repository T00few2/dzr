'use client'

import { useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { Button, Input, Text, Textarea, useToast } from '@chakra-ui/react'

export default function OutreachAdminPage() {
  const toast = useToast()
  const [ids, setIds] = useState('')
  const [message, setMessage] = useState('Hej {{username}}, husk at linke dit Zwift ID.')
  const [busy, setBusy] = useState(false)

  async function send() {
    const members = ids.split(/[\s,]+/).filter(Boolean).map((discord_id) => ({ discord_id, username: '' }))
    setBusy(true)
    const res = await fetch('/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members, messageTemplate: message }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    toast({
      title: res.ok ? `Sent ${body.sent || 0}, skipped ${body.skipped || 0}` : (body.error || 'Failed'),
      status: res.ok ? 'success' : 'error',
    })
  }

  return (
    <AdminShell title="Member outreach">
      <Text mb={2}>Discord IDs (comma or newline separated)</Text>
      <Input value={ids} onChange={(e) => setIds(e.target.value)} bg="gray.900" mb={4} />
      <Text mb={2}>Template. Use double curly braces around username to insert the Discord name when provided.</Text>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} bg="gray.900" mb={4} minH="160px" />
      <Button onClick={send} isLoading={busy} colorScheme="red">Send DMs</Button>
    </AdminShell>
  )
}
