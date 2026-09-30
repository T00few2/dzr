'use client'

import React from 'react'
import { Button, Container, Heading, ListItem, OrderedList, Stack, Text } from '@chakra-ui/react'
import { FaDiscord } from 'react-icons/fa'
import { track } from '@vercel/analytics'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'
import { INTERVALS_SETUP_STEPS } from '@/app/lib/intervalsCoachLinks'

export default function JoinCompletePage() {
  React.useEffect(() => {
    if (!sessionStorage.getItem('onboarding_completed_tracked')) {
      track('onboarding_funnel_completed')
      sessionStorage.setItem('onboarding_completed_tracked', '1')
    }
  }, [])

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={4} />
        <Heading color="white">Velkommen til DZR</Heading>
        <Text color="gray.300">Din indmeldelse er gennemført. Du kan nu fortsætte i fællesskabet og medlemsområderne.</Text>
        <Heading size="md" color="white">DZR Coach</Heading>
        <Text color="gray.300">
          Coachen læser din træning fra intervals.icu. Gør det her, før du forbinder den under Mine sider → Coach, eller via /coach i Discord:
        </Text>
        <OrderedList color="gray.300" spacing={2} pl={2}>
          {INTERVALS_SETUP_STEPS.map((step) => (
            <ListItem key={step}>{step}</ListItem>
          ))}
        </OrderedList>
        <Button as="a" href="/intervals/connect" colorScheme="red">
          Forbind intervals.icu
        </Button>
        <Button as="a" href="/about" colorScheme="red">
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
