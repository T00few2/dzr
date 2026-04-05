'use client'

import React from 'react'
import { Button, Container, Heading, Stack, Text } from '@chakra-ui/react'
import { FaDiscord } from 'react-icons/fa'
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
        <Text color="gray.300">Din indmeldelse er gennemfoert. Du kan nu fortsætte i fællesskabet og medlemsomraaderne.</Text>
        <Button as="a" href="/members-zone/about" colorScheme="red">
          Læs mere om DZR
        </Button>
        <Button
          as="a"
          href="https://discord.gg/FBtCsddbmU"
          target="_blank"
          rel="noopener noreferrer"
          leftIcon={<FaDiscord />}
          bg="rgba(88, 101, 242, 0.95)"
          color="white"
          _hover={{ bg: 'rgba(88, 101, 242, 1)' }}
        >
          Gå til DZR Discord-server
        </Button>
      </Stack>
    </Container>
  )
}
