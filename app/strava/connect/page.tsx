'use client'

import React, { Suspense, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Container,
  Heading,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ConnectForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [agreed, setAgreed] = useState(false)

  const href = useMemo(() => {
    const url = new URL('/api/strava/connect', typeof window !== 'undefined' ? window.location.origin : 'https://www.dzrracingseries.com')
    url.searchParams.set('consent', '1')
    if (token) url.searchParams.set('token', token)
    return `${url.pathname}${url.search}`
  }, [token])

  return (
    <VStack align="stretch" spacing={5}>
      <Text color="gray.300">
        DZR Coach uses your Strava data to give you personal training advice in a private Discord DM.
        Only paid club members (current year) can connect — Verified Member is not enough.
      </Text>

      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={2}>
          Når du forbinder Strava, accepterer du at:
        </Text>
        <UnorderedList color="gray.300" spacing={2} pl={2}>
          <ListItem>DZR læser din Strava-profil, zoner og aktiviteter (read-only).</ListItem>
          <ListItem>Aktivitetssammendrag og dine beskeder sendes til OpenAI for at generere coaching-svar.</ListItem>
          <ListItem>Vi gemmer kun dine Strava-tokens (ikke hele træningshistorikken) og kun til coaching i Discord.</ListItem>
          <ListItem>Du kan afbryde forbindelsen når som helst her på siden eller under Strava → Settings → My Apps.</ListItem>
        </UnorderedList>
      </Box>

      <Checkbox
        isChecked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        colorScheme="red"
        alignItems="flex-start"
      >
        <Text color="white">
          Jeg er betalende klubmedlem og giver DZR lov til at bruge mine Strava-data til AI-coaching i Discord.
        </Text>
      </Checkbox>

      <Button
        as="a"
        href={href}
        isDisabled={!agreed}
        bg="#ad1a2d"
        color="white"
        _hover={{ bg: '#8c1524' }}
        _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
      >
        Connect Strava
      </Button>

      <Text fontSize="sm" color="gray.500">
        Mangler du klubmedlemskab?{' '}
        <Link href="/join" style={{ textDecoration: 'underline' }}>
          Bliv medlem
        </Link>
      </Text>
    </VStack>
  )
}

export default function StravaConnectPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={6}>
        Forbind Strava til DZR Coach
      </Heading>
      <Suspense fallback={<Text>Loading…</Text>}>
        <ConnectForm />
      </Suspense>
    </Container>
  )
}
