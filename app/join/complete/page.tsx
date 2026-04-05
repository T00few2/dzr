'use client'

import React from 'react'
import { Button, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { track } from '@vercel/analytics'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'

export default function JoinCompletePage() {
  React.useEffect(() => {
    track('onboarding_funnel_completed')
  }, [])

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={4} />
        <Heading color="white">Velkommen til DZR</Heading>
        <Text color="gray.300">Din indmeldelse er gennemfoert. Du kan nu fortsætte i fællesskabet og medlemsomraaderne, når du er berettiget.</Text>
        <Button as="a" href="/members-zone/about" colorScheme="red">
          Læs mere om DZR
        </Button>
      </Stack>
    </Container>
  )
}
