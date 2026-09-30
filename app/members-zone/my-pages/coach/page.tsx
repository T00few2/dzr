'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Heading,
  Text,
  SimpleGrid,
  Button,
  Spinner,
  useToast,
  Link as ChakraLink,
  ListItem,
  OrderedList,
} from '@chakra-ui/react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import CoachMemoryEditor from '../profile/CoachMemoryEditor'
import ConnectIntervalsButton from '@/components/ConnectIntervalsButton'
import { IntervalsPrivacyLink } from '@/components/IntervalsPrivacyModal'
import { DZR_SUPPORT_EMAIL, INTERVALS_SETTINGS_URL, INTERVALS_SETUP_STEPS } from '@/app/lib/intervalsCoachLinks'

const secondaryButtonProps = {
  variant: 'outline' as const,
  color: 'gray.100',
  borderColor: 'gray.500',
  bg: 'gray.800',
  _hover: { bg: 'gray.700', borderColor: 'gray.400', color: 'white' },
}

export default function CoachPage() {
  const { data: session, status } = useSession()
  const toast = useToast()
  const cancelDisconnectRef = useRef<HTMLButtonElement>(null)
  const [intervals, setIntervals] = useState<{ connected: boolean; eligible?: boolean; athleteName?: string | null; connectedAt?: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)

  async function loadStatus() {
    const res = await fetch('/api/intervals/status', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setIntervals({
      connected: !!data?.connected,
      eligible: data?.eligible !== false,
      athleteName: data?.athleteName ?? null,
      connectedAt: data?.connectedAt ?? null,
    })
  }

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        await loadStatus()
      } catch {
        if (!ignore) setIntervals({ connected: false, eligible: false })
      }
    }
    if (session) load()
    return () => { ignore = true }
  }, [session])

  async function disconnect() {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/intervals/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Disconnect failed', status: 'error' })
        return false
      }
      await loadStatus()
      toast({
        title: 'intervals.icu afbrudt',
        description: data?.deletionNotified
          ? 'Vi har sendt en bekræftelse i din Discord-DM.'
          : 'Token, profil og noter er slettet.',
        status: 'success',
      })
      setNotice('Fjern også appen under intervals.icu → Settings, hvis den stadig står der.')
      return true
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 8 }} color="white">
        <Spinner size="sm" />
      </Box>
    )
  }

  if (!session) {
    return (
      <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 8 }} color="white">
        <Heading size="md" mb={4}>Coach</Heading>
        <Text mb={4}>Du er ikke logget ind.</Text>
        <Link href="/login" style={{ textDecoration: 'underline' }}>Gå til login</Link>
      </Box>
    )
  }

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 8 }} color="white">
      <Heading size={{ base: 'md', md: 'lg' }} mb={4}>Coach</Heading>
      <Text mb={6} color="white">
        Forbind intervals.icu og sæt dine rammer til DZR Coach.
      </Text>

      <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
        <Heading size="sm" mb={2}>intervals.icu</Heading>
        <Text color="gray.400" mb={4} fontSize="sm">
          Forbind intervals.icu for personlig træning i en privat DM fra DZR Coach. Skriv /coach
          på Discord-serveren for at åbne chatten. Afbrydelse sletter token, profil, noter og
          gemte træningstal. Vi sender en bekræftelse i en DM.{' '}
          <IntervalsPrivacyLink color="gray.400">Privatliv</IntervalsPrivacyLink>
          {' · '}
          <ChakraLink href={`mailto:${DZR_SUPPORT_EMAIL}`} textDecoration="underline">
            Support
          </ChakraLink>
          {' · '}
          <ChakraLink href={INTERVALS_SETTINGS_URL} isExternal textDecoration="underline">
            intervals.icu settings
          </ChakraLink>
        </Text>
        {!intervals ? (
          <Spinner size="sm" />
        ) : intervals.connected ? (
          <>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
              <Box>
                <Text fontWeight="bold" mb={1}>Status</Text>
                <Text>Forbundet{intervals.athleteName ? ` som ${intervals.athleteName}` : ''}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Forbundet</Text>
                <Text>{intervals.connectedAt ? new Date(intervals.connectedAt).toLocaleString() : '—'}</Text>
              </Box>
              <Box>
                <Button
                  onClick={() => setDisconnectConfirmOpen(true)}
                  isLoading={busy}
                  size="sm"
                  variant="outline"
                  colorScheme="red"
                  color="red.300"
                  borderColor="red.400"
                  _hover={{ bg: 'whiteAlpha.100' }}
                >
                  Afbryd intervals.icu
                </Button>
              </Box>
            </SimpleGrid>
            <Text fontWeight="semibold" mb={2} fontSize="sm">Så coachen kan se ture og sende pas til Zwift</Text>
            <OrderedList color="gray.300" spacing={1} pl={2} fontSize="sm">
              {INTERVALS_SETUP_STEPS.slice(1, 5).map((step) => (
                <ListItem key={step}>{step}</ListItem>
              ))}
            </OrderedList>
          </>
        ) : intervals.eligible === false ? (
          <Text>Coaching er kun for betalende klubmedlemmer. Forny medlemskab under Membership, eller gå til /join.</Text>
        ) : (
          <>
            <OrderedList color="gray.300" spacing={2} pl={2} mb={4} fontSize="sm">
              {INTERVALS_SETUP_STEPS.map((step) => (
                <ListItem key={step}>{step}</ListItem>
              ))}
            </OrderedList>
            <ConnectIntervalsButton href="/intervals/connect?force=1" />
            {notice && (
              <Text mt={3} fontSize="sm" color="orange.200">
                {notice}{' '}
                <ChakraLink href={INTERVALS_SETTINGS_URL} isExternal textDecoration="underline">
                  Åbn intervals.icu settings
                </ChakraLink>
              </Text>
            )}
          </>
        )}
      </Box>

      {intervals?.connected && <CoachMemoryEditor />}

      <AlertDialog
        isOpen={disconnectConfirmOpen}
        leastDestructiveRef={cancelDisconnectRef}
        onClose={() => {
          if (!busy) setDisconnectConfirmOpen(false)
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" color="gray.100" borderWidth="1px" borderColor="gray.600">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Afbryd intervals.icu?
            </AlertDialogHeader>
            <AlertDialogBody>
              Dette fjerner forbindelsen. Coach-profilen nulstilles, og chat-noter og gemte
              træningstal slettes. Du får en bekræftelse i en Discord-DM. Det kan ikke fortrydes.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelDisconnectRef}
                onClick={() => setDisconnectConfirmOpen(false)}
                isDisabled={busy}
                {...secondaryButtonProps}
                size="sm"
              >
                Annuller
              </Button>
              <Button
                ml={3}
                size="sm"
                bg="#ad1a2d"
                color="white"
                _hover={{ bg: '#8c1524' }}
                onClick={async () => {
                  const ok = await disconnect()
                  if (ok) setDisconnectConfirmOpen(false)
                }}
                isLoading={busy}
              >
                Afbryd
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
