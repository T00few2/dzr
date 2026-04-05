'use client'

import React from 'react'
import { Badge, Box, Button, Container, Heading, List, ListItem, Stack, Text } from '@chakra-ui/react'
import { FaDiscord } from 'react-icons/fa'

type SettingsResponse = { minAmountDkk?: number; maxAmountDkk?: number }

export default function JoinIndexPage() {
  const [kontingentText, setKontingentText] = React.useState<string>('Kontingentet fastsættes i indmeldelsesflowet.')

  React.useEffect(() => {
    let ignore = false

    async function loadSettings() {
      try {
        const res = await fetch('/api/membership/settings', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as SettingsResponse
        if (ignore) return

        const min = Number(data?.minAmountDkk)
        const max = Number(data?.maxAmountDkk)
        if (Number.isFinite(min) && Number.isFinite(max)) {
          setKontingentText(`Kontingentet er valgfrit mellem ${min} og ${max} DKK.`)
        }
      } catch {
        // Keep fallback text when settings cannot be loaded.
      }
    }

    loadSettings()
    return () => {
      ignore = true
    }
  }, [])

  return (
    <Container maxW="5xl" py={{ base: 8, md: 14 }}>
      <Stack spacing={8}>
        <Box textAlign="center">
          <Badge bg="#ad1a2d" color="white" px={3} py={1} borderRadius="full" mb={4}>
            Bliv medlem af DZR
          </Badge>
          <Heading color="white" size="2xl" mb={4}>
            Velkommen til Danish Zwift Racers
          </Heading>
          <Text color="gray.300" fontSize={{ base: 'md', md: 'lg' }} maxW="3xl" mx="auto">
            DZR er en almennyttig online cykelforening med fællesskab, træning og løb for ryttere i hele Danmark.
          </Text>
        </Box>

        <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          <Stack spacing={5}>
            <Heading color="white" size="md">
              Hvad får du som klubmedlem?
            </Heading>
            <List spacing={2} color="gray.200">
              <ListItem>• Adgang til DZR fællesskab og aktiviteter</ListItem>
              <ListItem>• Deltagelse i vores organiserede løb og holdmiljø</ListItem>
              <ListItem>• Mulighed for DCU e-licens via DZR</ListItem>
              <ListItem>• Adgang til DCU Forårsliga som del af vores klubsetup</ListItem>
              <ListItem>• Stemmeret på generalforsamlingen</ListItem>
            </List>
            <Text color="gray.300">
              Indmeldelsen foregår i 3 enkle trin: log ind med Discord, betal kontingent, og indtast dit Zwift ID.
            </Text>
            <Text color="gray.300">{kontingentText}</Text>
            <Text color="gray.300">
              Discord er en central del af DZR-fællesskabet, hvor vi koordinerer hold, events og kommunikation.
              Derfor bruger vi Discord-login i indmeldelsesflowet.
            </Text>
            <Text color="gray.300">
              Har du ikke en Discord-konto endnu, kan du oprette en gratis konto i forbindelse med login.
            </Text>
            <Button
              as="a"
              href="/join/discord"
              colorScheme="red"
              size="lg"
              leftIcon={<FaDiscord />}
              alignSelf="flex-start"
            >
              Start indmeldelse
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Container>
  )
}
