'use client'

import React from 'react'
import {
  Badge,
  Box,
  Button,
  Circle,
  Container,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  keyframes,
} from '@chakra-ui/react'
import { FaDiscord, FaRoad, FaUsers } from 'react-icons/fa'
import { FaTrophy } from 'react-icons/fa6'
import { MdCardMembership, MdDirectionsBike, MdHowToVote, MdPayment } from 'react-icons/md'
import { IconType } from 'react-icons'

const pulseShadow = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(173, 26, 45, 0.7); }
  70%  { box-shadow: 0 0 0 18px rgba(173, 26, 45, 0); }
  100% { box-shadow: 0 0 0 0 rgba(173, 26, 45, 0); }
`

type SettingsResponse = { minAmountDkk?: number; maxAmountDkk?: number }

interface BenefitCardProps {
  icon: IconType
  heading: string
  text: string
}

function BenefitCard({ icon, heading, text }: BenefitCardProps) {
  return (
    <HStack align="start" spacing={3} py={3}>
      <Icon as={icon} color="#ad1a2d" boxSize={5} flexShrink={0} mt="1px" />
      <Box>
        <Text color="white" fontWeight="semibold" fontSize="sm" mb={0.5}>
          {heading}
        </Text>
        <Text color="gray.400" fontSize="sm">
          {text}
        </Text>
      </Box>
    </HStack>
  )
}

interface StepProps {
  number: number
  icon: IconType
  label: string
}

function Step({ number, icon, label }: StepProps) {
  return (
    <Stack
      direction={{ base: 'row', md: 'column' }}
      spacing={{ base: 4, md: 2 }}
      flex={1}
      align="center"
    >
      <Circle
        size={{ base: '36px', md: '40px' }}
        bg="#ad1a2d"
        color="white"
        fontWeight="bold"
        fontSize={{ base: 'md', md: 'lg' }}
        flexShrink={0}
      >
        {number}
      </Circle>
      <Icon as={icon} boxSize={{ base: 5, md: 7 }} color="gray.300" flexShrink={0} />
      <Text color="gray.300" fontSize="sm" textAlign={{ base: 'left', md: 'center' }}>
        {label}
      </Text>
    </Stack>
  )
}

export default function JoinIndexPage() {
  const [kontingentText, setKontingentText] = React.useState<string>('Valgfrit beløb')
  const [kontingentRange, setKontingentRange] = React.useState<string | null>(null)

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
          setKontingentText(`${min}–${max} DKK`)
          setKontingentRange(`Kontingentet er valgfrit mellem ${min} og ${max} DKK.`)
        }
      } catch {
        // Keep fallback text when settings cannot be loaded.
      }
    }

    loadSettings()
    return () => { ignore = true }
  }, [])

  return (
    <Container maxW="5xl" py={{ base: 8, md: 14 }}>
      <Stack spacing={12}>

        {/* Zone 1 — Hero */}
        <Box textAlign="center">
          <Badge bg="#ad1a2d" color="white" px={3} py={1} borderRadius="full" mb={4}>
            Bliv klubmedlem af DZR
          </Badge>
          <Heading color="white" size="2xl" mb={4}>
            Velkommen til Danish Zwift Racers
          </Heading>
          <Text color="gray.300" fontSize={{ base: 'md', md: 'lg' }} maxW="3xl" mx="auto">
            DZR er en almennyttig online cykelforening med fællesskab, træning og løb for ryttere i hele Danmark.
          </Text>
        </Box>

        {/* Zone 2 — 3-step visual stepper */}
        <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          <Heading size="sm" mb={6} textTransform="uppercase" letterSpacing="wider" color="gray.400">
            Sådan foregår det — 3 enkle trin
          </Heading>
          <Flex
            direction={{ base: 'column', md: 'row' }}
            align={{ base: 'stretch', md: 'center' }}
            gap={{ base: 3, md: 0 }}
          >
            <Step number={1} icon={FaDiscord} label="Log ind med Discord" />
            <Divider
              display={{ base: 'none', md: 'block' }}
              borderColor="gray.600"
              borderStyle="dashed"
            />
            <Step number={2} icon={MdPayment} label="Betal kontingent" />
            <Divider
              display={{ base: 'none', md: 'block' }}
              borderColor="gray.600"
              borderStyle="dashed"
            />
            <Step number={3} icon={MdDirectionsBike} label="Indtast dit Zwift ID" />
          </Flex>
          <Text color="gray.400" fontSize="sm" mt={6}>
            Discord er en central del af DZR-fællesskabet, hvor vi koordinerer hold, events og kommunikation.
            Har du ikke en Discord-konto endnu, kan du oprette en gratis konto i forbindelse med login.
          </Text>
        </Box>

        {/* Zone 3 — Price + CTA */}
        <Box borderWidth="1px" borderColor="gray.600" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          <Stack spacing={4}>
            <HStack spacing={2}>
              <Icon as={MdPayment} color="green.300" boxSize={5} />
              <Text color="green.300" fontWeight="semibold">
                Kontingent: {kontingentText}
              </Text>
            </HStack>
            {kontingentRange && (
              <Text color="gray.400" fontSize="sm">{kontingentRange}</Text>
            )}
            <Button
              as="a"
              href="/join/discord"
              colorScheme="red"
              size="lg"
              leftIcon={<FaDiscord />}
              animation={`${pulseShadow} 2s infinite`}
              w="full"
            >
              Start indmeldelse
            </Button>
            <Text color="gray.500" fontSize="xs" textAlign="center">
              3 hurtige trin · Discord-konto kræves · Gratis at oprette
            </Text>
            <Text color="gray.600" fontSize="xs" textAlign="center">
              Betaling håndteres sikkert via MobilePay
            </Text>
          </Stack>
        </Box>

        {/* Zone 4 — Benefit Cards */}
        <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          <Heading size="sm" mb={4} textTransform="uppercase" letterSpacing="wider" color="gray.400">
            Bliv klubmedlem af DZR
          </Heading>
          <Stack spacing={0} divider={<Divider borderColor="gray.700" />}>
            <BenefitCard icon={FaUsers} heading="DZR fællesskab" text="Adgang til fællesskab og klubaktiviteter" />
            <BenefitCard icon={FaTrophy} heading="Løb & holdmiljø" text="Deltagelse i organiserede løb og holdmiljø" />
            <BenefitCard icon={MdCardMembership} heading="DCU e-licens" text="Mulighed for DCU e-licens via DZR" />
            <BenefitCard icon={FaRoad} heading="DCU Forårsliga" text="Adgang til DCU Forårsliga som del af klubsetup" />
            <BenefitCard icon={MdHowToVote} heading="Stemmeret" text="Stemmeret på DZRs generalforsamling" />
          </Stack>
        </Box>

      </Stack>
    </Container>
  )
}
