'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb'

export default function MembershipPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()
  const qp = useSearchParams()

  const isAdmin = Boolean((session as any)?.user?.isAdmin)
  const [settings, setSettings] = useState<{ minAmountDkk: number; maxAmountDkk: number; dualYearMode: boolean } | null>(null)
  const [summary, setSummary] = useState<{ currentStatus: string; coveredThroughYear: number | null; fullName: string | null } | null>(null)

  const [amount, setAmount] = useState<number>(50)
  const [fullName, setFullName] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    const statusParam = qp?.get('status')
    if (statusParam === 'success') {
      toast({ title: 'Payment successful', status: 'success' })
      router.replace('/members-zone/membership')
    } else if (statusParam === 'cancelled') {
      toast({ title: 'Payment cancelled', status: 'info' })
      router.replace('/members-zone/membership')
    }
  }, [qp, toast, router])

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const [s1, s2] = await Promise.all([
          fetch('/api/membership/settings', { cache: 'no-store' }),
          fetch('/api/membership/summary', { cache: 'no-store' }),
        ])
        if (!ignore) {
          if (s1.ok) {
            const a = await s1.json()
            setSettings(a)
            setAmount(a?.minAmountDkk ?? 10)
          }
          if (s2.ok) {
            const b = await s2.json()
            setSummary(b)
            if (b?.fullName) setFullName(String(b.fullName))
          }
        }
      } catch {}
    }
    if (session) load()
    return () => { ignore = true }
  }, [session])

  const coveredText = useMemo(() => {
    if (!summary?.coveredThroughYear) return 'Not covered for any year'
    return `Covered through ${summary.coveredThroughYear}`
  }, [summary])

  if (status === 'loading') return <LoadingSpinnerMemb />
  if (!session) {
    return (
      <Box px={6} py={8} color={'white'}>
        <Heading size="md" mb={4}>Membership</Heading>
        <Text mb={2}>You are not logged in.</Text>
      </Box>
    )
  }
  if (!isAdmin) {
    return (
      <Box px={6} py={8} color={'white'}>
        <Heading size="md" mb={4}>Membership</Heading>
        <Text mb={2}>Admins only.</Text>
      </Box>
    )
  }

  async function startCheckout() {
    try {
      setLoading(true)
      const res = await fetch('/api/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountDkk: amount, fullName }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create checkout')
      }
      window.location.href = data.url
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Checkout failed', status: 'error' })
      setLoading(false)
    }
  }

  return (
    <Container maxW={{ base: '95vw', sm: '80vw', md: '70vw' }}>
      <Stack spacing={4} textAlign={'left'}>
        <Heading color={'white'}>Membership</Heading>
        <Text color={'white'}>
          Status: {summary?.currentStatus === 'club' ? 'Club Member' : 'Community Member'} • {coveredText}
        </Text>
        <Divider />

        <Box borderWidth={'1px'} borderColor={'white'} borderRadius={'md'} p={4}>
          <Heading size="sm" color={'white'} mb={2}>Settings</Heading>
          <Text color={'white'}>Allowed amount: {settings ? `${settings.minAmountDkk}–${settings.maxAmountDkk} DKK` : '—'}</Text>
          <Text color={'white'}>Dual year mode: {settings?.dualYearMode ? 'On' : 'Off'}</Text>
        </Box>

        <Box borderWidth={'1px'} borderColor={'white'} borderRadius={'md'} p={4}>
          <Heading size="sm" color={'white'} mb={4}>Pay membership</Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel color={'white'}>Full name</FormLabel>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} bg="white" color="black" />
            </FormControl>
            <FormControl>
              <FormLabel color={'white'}>Amount (DKK)</FormLabel>
              <NumberInput
                min={settings?.minAmountDkk ?? 10}
                max={settings?.maxAmountDkk ?? 100}
                value={amount}
                onChange={(_, n) => setAmount(Number.isFinite(n) ? n : amount)}
              >
                <NumberInputField bg="white" color="black" />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            <HStack>
              <Button onClick={startCheckout} isLoading={loading} colorScheme="red">Pay with MobilePay / Card</Button>
            </HStack>
          </Stack>
        </Box>
      </Stack>
    </Container>
  )
}


