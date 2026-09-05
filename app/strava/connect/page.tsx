'use client'

import React, { Suspense, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Container,
  Heading,
  Link as ChakraLink,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ConnectWithStravaButton from '@/components/ConnectWithStravaButton'
import { DZR_SUPPORT_EMAIL, STRAVA_APPS_URL, STRAVA_PRIVACY_PATH } from '@/app/lib/stravaCoachLinks'

function ConnectForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const force = searchParams.get('force') === '1'
  const [agreed, setAgreed] = useState(false)

  const href = useMemo(() => {
    const url = new URL('/api/strava/connect', typeof window !== 'undefined' ? window.location.origin : 'https://www.dzrracingseries.com')
    url.searchParams.set('consent', '1')
    if (token) url.searchParams.set('token', token)
    if (force) url.searchParams.set('force', '1')
    return `${url.pathname}${url.search}`
  }, [token, force])

  return (
    <VStack align="stretch" spacing={5}>
      <Text color="gray.300">
        DZR Coach bruger dine Strava-data til at give dig personlige træningsråd i en privat Discord-DM.
        Kun betalende klubmedlemmer kan forbinde.
      </Text>

      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={2}>
          Når du forbinder Strava, accepterer du at:
        </Text>
        <UnorderedList color="gray.300" spacing={2} pl={2}>
          <ListItem>DZR læser din Strava-profil, zoner og aktiviteter (read-only).</ListItem>
          <ListItem>Aktivitetssammendrag og dine beskeder sendes til OpenAI for at generere coaching-svar. Hvis du har udfyldt coach-profilen, sendes de rammer med. Hvis du har slået chat-noter til, kan korte daterede notater fra samtalen også sendes med.</ListItem>
          <ListItem>Strava-tokens gemmes krypteret og bruges kun til coaching i Discord. Vi gemmer ikke hele din træningshistorik.</ListItem>
          <ListItem>Dine faste træningsrammer (fx 3–4 ture/uge, skader, skrivestil) retter du selv under Mine sider → Coach. Chat-noter er slået fra, indtil du slår dem til samme sted.</ListItem>
          <ListItem>
            Du kan trække samtykket tilbage når som helst: afbryd under Mine sider → Coach, eller
            fjern appen under{' '}
            <ChakraLink href={STRAVA_APPS_URL} isExternal textDecoration="underline">
              Strava → Settings → My Apps
            </ChakraLink>
            .
          </ListItem>
          <ListItem>
            Når du afbryder, sletter vi dine Strava-tokens, coach-profil og chat-noter og sender en
            bekræftelse i Discord-DM.
          </ListItem>
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

      <ConnectWithStravaButton href={href} disabled={!agreed} />

      <Text fontSize="sm" color="gray.500">
        <Link href={STRAVA_PRIVACY_PATH} style={{ textDecoration: 'underline' }}>
          Privatliv
        </Link>
        {' · '}
        <ChakraLink href={`mailto:${DZR_SUPPORT_EMAIL}`} textDecoration="underline">
          {DZR_SUPPORT_EMAIL}
        </ChakraLink>
        {' · '}
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
