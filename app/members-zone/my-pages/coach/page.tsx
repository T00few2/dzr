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
} from '@chakra-ui/react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import CoachMemoryEditor from '../profile/CoachMemoryEditor'
import ConnectWithStravaButton from '@/components/ConnectWithStravaButton'
import { DZR_SUPPORT_EMAIL, STRAVA_APPS_URL, STRAVA_PRIVACY_PATH } from '@/app/lib/stravaCoachLinks'

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
  const [strava, setStrava] = useState<{ connected: boolean; eligible?: boolean; athleteName?: string | null; connectedAt?: string | null } | null>(null)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [stravaNotice, setStravaNotice] = useState<string | null>(null)
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)

  async function loadStravaStatus() {
    const res = await fetch('/api/strava/status', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setStrava({
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
        await loadStravaStatus()
      } catch {
        if (!ignore) setStrava({ connected: false, eligible: false })
      }
    }
    if (session) load()
    return () => { ignore = true }
  }, [session])

  async function disconnectStrava() {
    setStravaBusy(true)
    setStravaNotice(null)
    try {
      const res = await fetch('/api/strava/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Disconnect failed', status: 'error' })
        return false
      }
      await loadStravaStatus()
      if (data?.revokedOnStrava) {
        toast({
          title: 'Strava disconnected',
          description: data?.deletionNotified
            ? 'We sent a deletion confirmation to your Discord DM.'
            : 'Tokens, profile, and notes were deleted.',
          status: 'success',
        })
        setStravaNotice(null)
      } else {
        toast({ title: 'Disconnected in DZR', status: 'warning' })
        setStravaNotice(
          'DZR no longer has your tokens, but Strava may still list the app. Remove it under Strava → Settings → My Apps if it is still there.'
        )
      }
      return true
    } finally {
      setStravaBusy(false)
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
        <Text mb={4}>You are not logged in.</Text>
        <Link href="/login" style={{ textDecoration: 'underline' }}>Go to login</Link>
      </Box>
    )
  }

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 8 }} color="white">
      <Heading size={{ base: 'md', md: 'lg' }} mb={4}>Coach</Heading>
      <Text mb={6} color="white">
        Forbind Strava og sæt dine rammer til DZR Coach.
      </Text>

      <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" p={4} mb={6}>
        <Heading size="sm" mb={2}>Strava</Heading>
        <Text color="gray.400" mb={4} fontSize="sm">
          Forbind Strava for at få personlig træningscoaching i en privat DM fra DZR Coach. Skriv
          /coach på Discord-serveren for at åbne chatten. Afbryd sletter
          tokens, profil og noter. Vi sender en bekræftelse i en DM fra DZR Coach.{' '}
          <ChakraLink as={Link} href={STRAVA_PRIVACY_PATH} textDecoration="underline">
            Privatliv
          </ChakraLink>
          {' · '}
          <ChakraLink href={`mailto:${DZR_SUPPORT_EMAIL}`} textDecoration="underline">
            Support
          </ChakraLink>
          {' · '}
          <ChakraLink href={STRAVA_APPS_URL} isExternal textDecoration="underline">
            Strava-apps
          </ChakraLink>
        </Text>
        {!strava ? (
          <Spinner size="sm" />
        ) : strava.connected ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Box>
              <Text fontWeight="bold" mb={1}>Status</Text>
              <Text>Connected{strava.athleteName ? ` as ${strava.athleteName}` : ''}</Text>
            </Box>
            <Box>
              <Text fontWeight="bold" mb={1}>Connected</Text>
              <Text>{strava.connectedAt ? new Date(strava.connectedAt).toLocaleString() : '—'}</Text>
            </Box>
            <Box>
              <Button
                onClick={() => setDisconnectConfirmOpen(true)}
                isLoading={stravaBusy}
                size="sm"
                variant="outline"
                colorScheme="red"
                color="red.300"
                borderColor="red.400"
                _hover={{ bg: 'whiteAlpha.100' }}
              >
                Disconnect Strava
              </Button>
            </Box>
          </SimpleGrid>
        ) : strava.eligible === false ? (
          <Text>Coaching er kun for betalende klubmedlemmer. Forny medlemskab under Membership, eller gå til /join.</Text>
        ) : (
          <>
            <ConnectWithStravaButton href="/strava/connect?force=1" />
            {stravaNotice && (
              <Text mt={3} fontSize="sm" color="orange.200">
                {stravaNotice}{' '}
                <ChakraLink href="https://www.strava.com/settings/apps" isExternal textDecoration="underline">
                  Open Strava apps
                </ChakraLink>
              </Text>
            )}
          </>
        )}
      </Box>

      {strava?.connected && <CoachMemoryEditor />}

      <AlertDialog
        isOpen={disconnectConfirmOpen}
        leastDestructiveRef={cancelDisconnectRef}
        onClose={() => {
          if (!stravaBusy) setDisconnectConfirmOpen(false)
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" color="gray.100" borderWidth="1px" borderColor="gray.600">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Disconnect Strava?
            </AlertDialogHeader>
            <AlertDialogBody>
              Strava-forbindelsen afbrydes. Coach-profilen nulstilles, og alle chat-noter slettes.
              Du får en bekræftelse i Discord-DM. Det kan ikke fortrydes.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelDisconnectRef}
                onClick={() => setDisconnectConfirmOpen(false)}
                isDisabled={stravaBusy}
                {...secondaryButtonProps}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                ml={3}
                size="sm"
                bg="#ad1a2d"
                color="white"
                _hover={{ bg: '#8c1524' }}
                onClick={async () => {
                  const ok = await disconnectStrava()
                  if (ok) setDisconnectConfirmOpen(false)
                }}
                isLoading={stravaBusy}
              >
                Disconnect Strava
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
