'use client'

import React, { useContext, useMemo, useEffect, useState } from 'react'
import { Box, Heading, Text, Stack, Flex, Badge, Divider, SimpleGrid } from '@chakra-ui/react'
import { useSession } from 'next-auth/react'
import { AuthContext } from '@/components/auth/AuthContext'
import Link from 'next/link'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const { currentUser } = useContext(AuthContext)
  const [zwiftId, setZwiftId] = useState<string | null>(null)
  const [roleNames, setRoleNames] = useState<string[] | null>(null)
  const [memberSummary, setMemberSummary] = useState<{ currentStatus?: string; coveredThroughYear?: number | null; fullName?: string | null } | null>(null)

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


