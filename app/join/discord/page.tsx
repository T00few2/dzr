'use client'

import React from 'react'
import { Button, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { track } from '@vercel/analytics'
import { FaDiscord } from 'react-icons/fa'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'
import { signOut } from 'next-auth/react'

type OnboardingSessionResponse = {
  session: {
    steps?: { discordLinked?: boolean; paymentSucceeded?: boolean; zwiftLinked?: boolean }
    discordUsername?: string | null
    discordId?: string | null
  } | null
}

export default function JoinDiscordPage() {
  const [loading, setLoading] = React.useState(true)
  const [discordLinked, setDiscordLinked] = React.useState(false)
  const [linkedFromLogin, setLinkedFromLogin] = React.useState(false)
  const [linkedIdentity, setLinkedIdentity] = React.useState<string>('')
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [canUnlink, setCanUnlink] = React.useState(false)
  const [infoMessage, setInfoMessage] = React.useState('')

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
      const autoLinkRes = await fetch('/api/onboarding/discord/link-from-session', {
        method: 'POST',
        cache: 'no-store',
      })
      if (autoLinkRes.ok) {
        const auto = await autoLinkRes.json().catch(() => ({} as any))
        if (auto?.linked) {
          setLinkedFromLogin(true)
        }
      }
      const sessionRes = await fetch('/api/onboarding/session', { cache: 'no-store' })
      const data = (await sessionRes.json()) as OnboardingSessionResponse
      if (ignore) return
      setDiscordLinked(Boolean(data?.session?.steps?.discordLinked))
      const paymentDone = Boolean(data?.session?.steps?.paymentSucceeded || data?.session?.steps?.zwiftLinked)
      setCanUnlink(!paymentDone)
      const username = String(data?.session?.discordUsername || '').trim()
      const discordId = String(data?.session?.discordId || '').trim()
      setLinkedIdentity(username || (discordId ? `Discord bruger ${discordId}` : 'Discord-konto'))
      setLoading(false)
      track('onboarding_step_view', { step: 'discord_link' })
    }
    init().catch(() => setLoading(false))
    return () => {
      ignore = true
    }
  }, [])

  async function unlinkDiscordProfile() {
    try {
      setIsRemoving(true)
      setInfoMessage('')
      const res = await fetch('/api/onboarding/discord/unlink', { method: 'POST' })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke logge ud af den linkede profil')
      setDiscordLinked(false)
      setLinkedFromLogin(false)
      setLinkedIdentity('')
      track('onboarding_discord_unlinked')
      await signOut({ callbackUrl: '/join/discord' })
    } catch (err: any) {
      setInfoMessage(err?.message || 'Kunne ikke logge ud af den linkede profil')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={1} />
        <Heading color="white">Bliv medlem af DZR - Trin 1 af 3</Heading>
        {!discordLinked ? (
          <Text color="gray.300">
            Log ind med Discord for at starte din indmeldelse. Discord er en central del af vores fællesskab, hvor vi koordinerer hold, events og kommunikation.
          </Text>
        ) : (
          <Text color="green.300">
            Du er logget ind som {linkedIdentity}{' '}
            {canUnlink ? (
              <Text
                as="button"
                type="button"
                color="red.200"
                textDecoration="underline"
                _hover={{ color: 'red.100' }}
                onClick={unlinkDiscordProfile}
                isTruncated={false}
                disabled={isRemoving}
              >
                (log ud)
              </Text>
            ) : (
              <Text as="span">(log ud er ikke tilgængelig)</Text>
            )}
            . Fortsæt til betaling.
          </Text>
        )}
        {!discordLinked ? (
          <Text color="gray.300">
            Har du ikke en Discord-konto endnu, kan du oprette en gratis konto i login-flowet.
          </Text>
        ) : null}
        {infoMessage ? <Text color="orange.300">{infoMessage}</Text> : null}
        {discordLinked ? (
          <Stack spacing={3}>
            <Button as="a" href="/join/payment" colorScheme="red" onClick={() => track('onboarding_continue_after_discord')}>
              Fortsæt til betaling
            </Button>
          </Stack>
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
            Log ind med Discord
          </Button>
        )}
      </Stack>
    </Container>
  )
}
