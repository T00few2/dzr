'use client'

import React from 'react'
import { Button, Container, FormControl, FormLabel, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { track } from '@vercel/analytics'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'

type SessionState = {
  session: {
    steps?: { paymentSucceeded?: boolean; zwiftLinked?: boolean }
    zwiftId?: string | null
  } | null
}
type OnboardingStatusResponse = { membershipAlreadyPaid?: boolean; coveredThroughYear?: number | null; zwiftId?: string | null }

export default function JoinZwiftIdPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [canEdit, setCanEdit] = React.useState(false)
  const [zwiftId, setZwiftId] = React.useState('')
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    let ignore = false
    async function load() {
      const [res, statusRes] = await Promise.all([
        fetch('/api/onboarding/session', { cache: 'no-store' }),
        fetch('/api/onboarding/status', { cache: 'no-store' }),
      ])
      const data = (await res.json()) as SessionState
      if (ignore) return
      const paidInSession = Boolean(data?.session?.steps?.paymentSucceeded)
      setCanEdit(paidInSession)
      if (data?.session?.zwiftId) {
        setZwiftId(String(data.session.zwiftId))
      }
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as OnboardingStatusResponse
        const paidByMembership = Boolean(statusData?.membershipAlreadyPaid)
        if (paidByMembership) {
          setCanEdit(true)
        }
        if (statusData?.zwiftId) {
          setZwiftId(String(statusData.zwiftId))
          setMessage(`Zwift ID already set: ${String(statusData.zwiftId)}`)
        }
      }
      setLoading(false)
      track('onboarding_step_view', { step: 'zwift_id' })
    }
    load().catch(() => setLoading(false))
    return () => {
      ignore = true
    }
  }, [])

  async function saveZwiftId() {
    try {
      setSaving(true)
      setMessage('')
      const res = await fetch('/api/onboarding/zwift-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zwiftId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not save Zwift ID')
      track('onboarding_step3_zwift_saved')
      window.location.href = '/join/complete'
    } catch (err: any) {
      setMessage(err?.message || 'Could not save Zwift ID')
      setSaving(false)
    }
  }

  if (!canEdit && !loading) {
    return (
      <Container maxW="4xl" py={10}>
        <Stack spacing={4}>
          <StepProgressHeader currentStep={3} />
          <Heading color="white">Join DZR - Step 3 of 3</Heading>
          <Text color="gray.300">Please complete payment before entering your Zwift ID.</Text>
          <Button as="a" href="/join/payment" colorScheme="red">
            Go to Step 2
          </Button>
        </Stack>
      </Container>
    )
  }

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={3} />
        <Heading color="white">Join DZR - Step 3 of 3</Heading>
        <Text color="gray.300">Enter your Zwift ID to complete onboarding.</Text>
        {message ? <Text color="orange.300">{message}</Text> : null}
        <FormControl>
          <FormLabel color="white">Zwift ID</FormLabel>
          <Input value={zwiftId} onChange={(e) => setZwiftId(e.target.value)} bg="white" color="black" placeholder="e.g. 1234567" />
        </FormControl>
        <Button onClick={saveZwiftId} isLoading={saving || loading} colorScheme="red">
          Complete onboarding
        </Button>
      </Stack>
    </Container>
  )
}
