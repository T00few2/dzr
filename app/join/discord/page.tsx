'use client'

import React from 'react'
import { Button, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { track } from '@vercel/analytics'
import { FaDiscord } from 'react-icons/fa'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'

type OnboardingSessionResponse = {
  session: {
    steps?: { discordLinked?: boolean }
  } | null
}

export default function JoinDiscordPage() {
  const [loading, setLoading] = React.useState(true)
  const [discordLinked, setDiscordLinked] = React.useState(false)

  React.useEffect(() => {
    let ignore = false
    async function init() {
      const search = new URLSearchParams(window.location.search)
      const utm: Record<string, string> = {}
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
        const value = search.get(key)
        if (value) utm[key] = value
      }
      await fetch('/api/onboarding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utm }),
      })
      const sessionRes = await fetch('/api/onboarding/session', { cache: 'no-store' })
      const data = (await sessionRes.json()) as OnboardingSessionResponse
      if (ignore) return
      setDiscordLinked(Boolean(data?.session?.steps?.discordLinked))
      setLoading(false)
      track('onboarding_step_view', { step: 'discord_link' })
    }
    init().catch(() => setLoading(false))
    return () => {
      ignore = true
    }
  }, [])

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={1} />
        <Heading color="white">Join DZR - Step 1 of 3</Heading>
        <Text color="gray.300">Link your Discord profile to start your member onboarding.</Text>
        {discordLinked ? (
          <Button as="a" href="/join/payment" colorScheme="red" onClick={() => track('onboarding_continue_after_discord')}>
            Continue to payment
          </Button>
        ) : (
          <Button
            as="a"
            href="/api/onboarding/discord/start"
            leftIcon={<FaDiscord />}
            bg="rgba(88, 101, 242, 0.95)"
            color="white"
            _hover={{ bg: 'rgba(88, 101, 242, 1)' }}
            isLoading={loading}
            onClick={() => track('onboarding_discord_link_start')}
          >
            Link Discord profile
          </Button>
        )}
      </Stack>
    </Container>
  )
}
