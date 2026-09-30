'use client'

import React, { Suspense, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Container,
  Heading,
  Link as ChakraLink,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ConnectIntervalsButton from '@/components/ConnectIntervalsButton'
import { IntervalsPrivacyLink } from '@/components/IntervalsPrivacyModal'
import { DZR_SUPPORT_EMAIL, INTERVALS_SETTINGS_URL, INTERVALS_SETUP_STEPS } from '@/app/lib/intervalsCoachLinks'

function ConnectForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const force = searchParams.get('force') === '1'
  const [agreed, setAgreed] = useState(false)

  const href = useMemo(() => {
    const url = new URL('/api/intervals/connect', typeof window !== 'undefined' ? window.location.origin : 'https://www.dzrracingseries.com')
    url.searchParams.set('consent', '1')
    if (token) url.searchParams.set('token', token)
    if (force) url.searchParams.set('force', '1')
    return `${url.pathname}${url.search}`
  }, [token, force])

  return (
    <VStack align="stretch" spacing={5}>
      <Text color="gray.300">
        DZR Coach læser din træning fra intervals.icu og kan lægge et planlagt pas på kalenderen,
        så det kan dukke op i Zwift. Kun betalende klubmedlemmer kan forbinde. Skriv /coach på
        Discord-serveren for at åbne chatten.
      </Text>

      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={2}>
          Gør det her i intervals.icu, før du forbinder
        </Text>
        <OrderedList color="gray.300" spacing={2} pl={2}>
          {INTERVALS_SETUP_STEPS.map((step) => (
            <ListItem key={step}>{step}</ListItem>
          ))}
        </OrderedList>
        <Text mt={3} fontSize="sm">
          <ChakraLink href={INTERVALS_SETTINGS_URL} isExternal textDecoration="underline">
            Åbn intervals.icu settings
          </ChakraLink>
        </Text>
      </Box>

      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4}>
        <Text fontWeight="semibold" mb={2}>
          Når du forbinder, accepterer du at:
        </Text>
        <UnorderedList color="gray.300" spacing={2} pl={2}>
          <ListItem>DZR læser profil, zoner, wellness, planlagte pas og aktiviteter.</ListItem>
          <ListItem>
            DZR må lægge et planlagt pas på din intervals.icu-kalender, når du beder coachen om en
            træningsfil. intervals.icu kan derefter sende den næste uges pas til Zwift, hvis du har
            slået upload til.
          </ListItem>
          <ListItem>
            Aktivitetssammendrag og dine beskeder sendes til OpenAI for at generere coaching-svar.
          </ListItem>
          <ListItem>Adgangstoken gemmes krypteret og bruges kun til coaching.</ListItem>
          <ListItem>
            Du kan trække samtykket tilbage under Mine sider → Coach, eller fjerne appen under
            intervals.icu → Settings.
          </ListItem>
        </UnorderedList>
      </Box>

      <Checkbox isChecked={agreed} onChange={(e) => setAgreed(e.target.checked)} colorScheme="red" alignItems="flex-start">
        <Text color="white">
          Jeg er betalende klubmedlem og giver DZR lov til at bruge mine intervals.icu-data til
          AI-coaching i Discord, og til at lægge planlagte pas på min kalender, når jeg beder om det.
        </Text>
      </Checkbox>

      <ConnectIntervalsButton href={href} disabled={!agreed} />

      <Text fontSize="sm" color="gray.500">
        <IntervalsPrivacyLink>Privatliv</IntervalsPrivacyLink>
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

export default function IntervalsConnectPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={6}>
        Forbind intervals.icu til DZR Coach
      </Heading>
      <Suspense fallback={<Text>Loading…</Text>}>
        <ConnectForm />
      </Suspense>
    </Container>
  )
}
