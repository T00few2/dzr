'use client'

import React, { useContext, useMemo, useEffect, useState } from 'react'
import { Box, Heading, Text, Flex, Badge, SimpleGrid, Button, Spinner, useToast, Link as ChakraLink } from '@chakra-ui/react'
import { useSession } from 'next-auth/react'
import { AuthContext } from '@/components/auth/AuthContext'
import Link from 'next/link'
import CoachMemoryEditor from './CoachMemoryEditor'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const { currentUser } = useContext(AuthContext)
  const toast = useToast()
  const [zwiftId, setZwiftId] = useState<string | null>(null)
  const [roleNames, setRoleNames] = useState<string[] | null>(null)
  const [memberSummary, setMemberSummary] = useState<{ currentStatus?: string; coveredThroughYear?: number | null; fullName?: string | null } | null>(null)
  const [strava, setStrava] = useState<{ connected: boolean; eligible?: boolean; athleteName?: string | null; connectedAt?: string | null } | null>(null)
  const [stravaBusy, setStravaBusy] = useState(false)
  const [stravaNotice, setStravaNotice] = useState<string | null>(null)

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
    async function fetchZwiftId() {
      try {
        const resp = await fetch('/api/members/zwift-id', { cache: 'no-store' })
        if (!resp.ok) return
        const data = await resp.json()
        if (!ignore) setZwiftId(data?.zwiftId ?? null)
      } catch (_) {}
    }
    if (session) fetchZwiftId()
    return () => { ignore = true }
  }, [session])

  useEffect(() => {
    let ignore = false
    async function fetchRoleNames() {
      try {
        const res = await fetch('/api/discord/roles', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const roles: Array<{ id: string; name: string }> = Array.isArray(data?.roles) ? data.roles : []
        const idToName = new Map(roles.map(r => [String(r.id), String(r.name)]))
        const ids: string[] = Array.isArray((session as any)?.user?.roles) ? ((session as any).user.roles as string[]) : []
        const names = ids.map(id => idToName.get(String(id)) || String(id))
        if (!ignore) setRoleNames(names)
      } catch {}
    }
    if (session) fetchRoleNames()
    return () => { ignore = true }
  }, [session])

  useEffect(() => {
    let ignore = false
    async function fetchMembership() {
      try {
        const res = await fetch('/api/membership/summary', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!ignore) setMemberSummary({ currentStatus: data?.currentStatus, coveredThroughYear: data?.coveredThroughYear ?? null, fullName: data?.fullName ?? null })
      } catch {}
    }
    if (session) fetchMembership()
    return () => { ignore = true }
  }, [session])

  useEffect(() => {
    let ignore = false
    async function fetchStrava() {
      try {
        await loadStravaStatus()
      } catch {}
    }
    if (session) fetchStrava()
    return () => { ignore = true }
  }, [session])

  const profile = useMemo(() => {
    const user = (session?.user || {}) as any
    return {
      name: user.name || currentUser?.displayName || '—',
      email: user.email || '—',
      discordId: user.discordId || '—',
      roles: Array.isArray(user.roles) ? user.roles : [],
      createdAt: currentUser?.metadata?.creationTime || '—',
      lastSignInAt: currentUser?.metadata?.lastSignInTime || '—',
    }
  }, [session, currentUser])

  if (status === 'loading') {
    return (
      <Box px={6} py={8} color={'white'}>
        <Heading size="md" mb={4}>Profile</Heading>
        <Text>Loading…</Text>
      </Box>
    )
  }

  if (!session) {
    return (
      <Box px={6} py={8} color={'white'}>
        <Heading size="md" mb={4}>Profile</Heading>
        <Text mb={4}>You are not logged in.</Text>
        <Link href="/login" style={{ textDecoration: 'underline' }}>Go to login</Link>
      </Box>
    )
  }

  const isClub = memberSummary?.currentStatus === 'club'
  const displayName = memberSummary?.fullName || profile.name
  const expiryDateText = (() => {
    const y = memberSummary?.coveredThroughYear
    if (!y || typeof y !== 'number') return '—'
    const d = new Date(Date.UTC(y, 11, 31)) // 31 Dec <year> UTC
    const day = String(d.getUTCDate()).padStart(2, '0')
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames[d.getUTCMonth()]
    return `${day} ${month} ${y}`
  })()

  async function disconnectStrava() {
    setStravaBusy(true)
    setStravaNotice(null)
    try {
      const res = await fetch('/api/strava/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data?.error || 'Disconnect failed', status: 'error' })
        return
      }
      await loadStravaStatus()
      if (data?.revokedOnStrava) {
        toast({ title: 'Strava disconnected', status: 'success' })
        setStravaNotice(null)
      } else {
        toast({ title: 'Disconnected in DZR', status: 'warning' })
        setStravaNotice(
          'DZR no longer has your tokens, but Strava may still list the app. Remove it under Strava → Settings → My Apps if it is still there.'
        )
      }
    } finally {
      setStravaBusy(false)
    }
  }

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 100, md: 100 }} color={'white'}>
      <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" mb={4} gap={4} direction={{ base: 'column', md: 'row' }}>
        <Heading size={{ base: 'md', md: 'lg' }}>Profile</Heading>
        <Badge colorScheme={profile.email !== '—' ? 'green' : 'gray'}>{profile.email !== '—' ? 'Logged in' : 'Guest'}</Badge>
      </Flex>

      <Text mb={4} color={'white'}>
        Her kan du se dine kontooplysninger, medlemskabsstatus og Discord-roller.
      </Text>

      {/* Primary Info */}
      <Box borderWidth={'1px'} borderColor={'gray.700'} borderRadius={'md'} p={4} mb={6}>
        <Heading size="sm" mb={4}>Account</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {isClub && displayName !== '—' ? (
            <>
              <Box>
                <Text fontWeight="bold" mb={1}>Name</Text>
                <Text>{displayName}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Email</Text>
                <Text>{profile.email}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Zwift ID</Text>
                <Text>{zwiftId || '—'}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Last sign-in</Text>
                <Text>{profile.lastSignInAt}</Text>
              </Box>
            </>
          ) : (
            <>
              <Box>
                <Text fontWeight="bold" mb={1}>Email</Text>
                <Text>{profile.email}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Zwift ID</Text>
                <Text>{zwiftId || '—'}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Name</Text>
                <Text>{displayName}</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" mb={1}>Last sign-in</Text>
                <Text>{profile.lastSignInAt}</Text>
              </Box>
            </>
          )}
        </SimpleGrid>
      </Box>

      {/* Membership Info */}
      <Box borderWidth={'1px'} borderColor={'gray.700'} borderRadius={'md'} p={4} mb={6}>
        <Heading size="sm" mb={4}>Membership</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Box>
            <Text fontWeight="bold" mb={1}>Status</Text>
            <Text>{isClub ? 'Club Member' : 'Community Member'}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" mb={1}>Expiry date</Text>
            <Text>{expiryDateText}</Text>
          </Box>
        </SimpleGrid>
      </Box>

      {/* Strava coaching */}
      <Box borderWidth={'1px'} borderColor={'gray.700'} borderRadius={'md'} p={4} mb={6}>
        <Heading size="sm" mb={2}>Strava / DZR Coach</Heading>
        <Text color="gray.400" mb={4} fontSize="sm">
          Forbind Strava for at få personlig træningscoaching i en privat Discord-DM. Kun betalende klubmedlemmer (indeværende år).
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
                onClick={disconnectStrava}
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
            <Button as="a" href="/strava/connect?force=1" size="sm" bg="#ad1a2d" color="white" _hover={{ bg: '#8c1524' }}>
              Connect Strava
            </Button>
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

      <CoachMemoryEditor />

      {/* Discord Info */}
      <Box borderWidth={'1px'} borderColor={'gray.700'} borderRadius={'md'} p={4}>
        <Heading size="sm" mb={4}>Discord</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Box>
            <Text fontWeight="bold" mb={1}>Display Name</Text>
            <Text>{profile.name}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" mb={1}>Discord ID</Text>
            <Text>{profile.discordId}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" mb={1}>Roles</Text>
            <Text>{(roleNames && roleNames.length) ? roleNames.join(', ') : (profile.roles.length ? profile.roles.join(', ') : '—')}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold" mb={1}>Created</Text>
            <Text>{profile.createdAt}</Text>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  )
}


