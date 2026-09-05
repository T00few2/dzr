'use client'

import { Suspense } from 'react'
import { Container, Heading, Text } from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StravaPrivacyLink } from '@/components/StravaPrivacyModal'

const REASONS: Record<string, string> = {
  not_club_member:
    'DZR Coach er kun for betalende klubmedlemmer (indeværende år). Verified Member er ikke nok.',
  denied: 'Du afviste Strava-adgang. Ingen data blev gemt.',
  invalid_or_expired_link: 'Linket er ugyldigt eller udløbet. Brug /coach i Discord for at få et nyt.',
  not_logged_in: 'Log ind på members zone, eller start fra /coach i Discord.',
  missing_strava_env: 'Strava er ikke konfigureret på serveren endnu.',
  token_exchange_failed: 'Kunne ikke fuldføre Strava-login. Prøv igen.',
  missing_code: 'Strava sendte ikke en autorisationskode. Prøv igen.',
  connect_failed: 'Kunne ikke starte Strava-forbindelsen. Prøv igen.',
  callback_failed: 'Noget gik galt efter Strava-login. Prøv igen.',
  strava_error: 'Strava returnerede en fejl. Prøv igen.',
}

function ErrorBody() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') || ''
  const message = REASONS[reason] || 'Noget gik galt. Prøv igen fra Discord med /coach.'

  return (
    <>
      <Text color="gray.300" mb={4}>
        {message}
      </Text>
      <Text fontSize="sm" color="gray.500">
        <Link href="/strava/connect" style={{ textDecoration: 'underline' }}>
          Tilbage til connect
        </Link>
        {' · '}
        <StravaPrivacyLink>Privatliv</StravaPrivacyLink>
        {' · '}
        <Link href="/join" style={{ textDecoration: 'underline' }}>
          Bliv klubmedlem
        </Link>
      </Text>
    </>
  )
}

export default function StravaErrorPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={4}>
        Kunne ikke forbinde Strava
      </Heading>
      <Suspense fallback={<Text>Loading…</Text>}>
        <ErrorBody />
      </Suspense>
    </Container>
  )
}
