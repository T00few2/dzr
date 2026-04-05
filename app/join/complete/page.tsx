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
        <Heading color="white">Welcome to DZR</Heading>
        <Text color="gray.300">Your onboarding is complete. You can now continue in the community and members area when eligible.</Text>
        <Button as="a" href="/members-zone/about" colorScheme="red">
          Learn more about DZR
        </Button>
      </Stack>
    </Container>
  )
}
