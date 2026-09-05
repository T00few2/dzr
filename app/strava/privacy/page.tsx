'use client'

import { Container, Heading } from '@chakra-ui/react'
import StravaPrivacyContent from '@/components/StravaPrivacyContent'

export default function StravaCoachPrivacyPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={6}>
        Privatliv — DZR Coach og Strava
      </Heading>
      <StravaPrivacyContent showBackLink />
    </Container>
  )
}
