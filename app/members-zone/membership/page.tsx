'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  useToast,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SimpleGrid,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
} from '@chakra-ui/react'
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb'

function MembershipContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()
  const qp = useSearchParams()

  const isAdmin = Boolean((session as any)?.user?.isAdmin)
  const [settings, setSettings] = useState<{ minAmountDkk: number; maxAmountDkk: number; dualYearMode: boolean; paymentOptions?: Array<{ id: string; label?: string; coversYears?: number[] }> } | null>(null)
  const [summary, setSummary] = useState<{ currentStatus: string; coveredThroughYear: number | null; fullName: string | null; coveredYears?: number[] } | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string>('')

  const [amount, setAmount] = useState<number>(50)
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
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
            const min = Number(a?.minAmountDkk ?? 10)
            const max = Number(a?.maxAmountDkk ?? 100)
            const initial = Math.min(Math.max(50, min), max || 999999)
            setAmount(initial)
          }
          if (s2.ok) {
            const b = await s2.json()
            setSummary(b)
            if (b?.fullName) {
              const parts = String(b.fullName).trim().split(/\s+/)
              setFirstName(parts[0] || '')
              setLastName(parts.slice(1).join(' ') || '')
            }
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

  const expiryDateText = useMemo(() => {
    const y = summary?.coveredThroughYear
    if (!y || typeof y !== 'number') return '—'
    const d = new Date(Date.UTC(y, 11, 31))
    const day = String(d.getUTCDate()).padStart(2, '0')
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames[d.getUTCMonth()]
    return `${day} ${month} ${y}`
  }, [summary])

  const rangeText = useMemo(() => {
    const min = settings?.minAmountDkk
    const max = settings?.maxAmountDkk
    if (typeof min === 'number' && typeof max === 'number') {
      return ` Kontingentet er valgfrit mellem ${min} og ${max} DKK.`
    }
    return ''
  }, [settings])

  const isActiveClub = (() => {
    const y = new Date().getUTCFullYear()
    return summary?.currentStatus === 'club' && typeof summary?.coveredThroughYear === 'number' && summary.coveredThroughYear >= y
  })()

  const coverageTextFromSelection = useMemo(() => {
    if (!selectedOptionId) return 'Vælg år for at se dækning.'
    const opt = (settings?.paymentOptions || []).find(o => String(o?.id || '') === selectedOptionId)
    const years = (opt?.coversYears || []).map((n) => Number(n)).filter((n) => Number.isFinite(n)).sort()
    if (!years.length) return ''
    const nowY = new Date().getUTCFullYear()
    if (years.length === 1) {
      const y = years[0]
      if (y === nowY) return `Medlemskab gælder for resten af ${y}`
      return `Medlemskab gælder for hele ${y}`
    }
    if (years.length === 2) {
      const [a, b] = years
      if (a === nowY && b === nowY + 1) return `Medlemskab gælder for resten af ${a} og hele ${b}`
      return `Medlemskab gælder for ${a} og ${b}`
    }
    return `Medlemskab gælder for ${years.join(' og ')}`
  }, [selectedOptionId, settings])

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
      const fullName = `${firstName || ''} ${lastName || ''}`.trim()
      if (!firstName || !lastName) {
        throw new Error('Please enter first and last name')
      }
      if (!selectedOptionId) {
        throw new Error('Vælg venligst år for betaling')
      }
      // Prevent selecting options that include already covered years
      const option = (settings?.paymentOptions || []).find(o => String(o?.id || '') === selectedOptionId)
      const coveredYears = new Set<number>((summary?.coveredYears || []) as number[])
      const overlaps = option?.coversYears?.some((y) => coveredYears.has(Number(y))) || false
      if (overlaps) {
        throw new Error('Du har allerede betalt for det valgte år')
      }
      const res = await fetch('/api/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountDkk: amount, fullName, selectedOptionId }),
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
          Her kan du se din medlemsstatus og betale kontingent.{rangeText} Udfyld fornavn og efternavn,
          vælg et beløb med skyderen og tryk “Betal” for at gennemføre betaling.
        </Text>

        {/* Status card matching Profile page styling */}
        <Box borderWidth={'1px'} borderColor={'white'} borderRadius={'md'} p={4}>
          <Heading size="sm" color={'white'} mb={4}>Nuværende medlemskab</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Box>
              <Text fontWeight="bold" mb={1} color={'white'}>Status</Text>
              <Text color={'white'}>{summary?.currentStatus === 'club' ? 'Club member' : 'Community Member'}</Text>
            </Box>
            <Box>
              <Text fontWeight="bold" mb={1} color={'white'}>Udløbsdato</Text>
              <Text color={'white'}>{expiryDateText}</Text>
            </Box>
          </SimpleGrid>
        </Box>

        {/* Terms and Conditions */}
        <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" bg="gray.800">
          <Accordion allowToggle>
            <AccordionItem border="none">
              <h2>
                <AccordionButton _hover={{ bg: 'gray.700' }} py={4}>
                  <HStack flex="1" textAlign="left" spacing={3}>
                    <Box color="gray.400" fontSize="xl">ℹ️</Box>
                    <Text color="white" fontWeight="bold" fontSize="md">
                      Vilkår for medlemskab
                    </Text>
                  </HStack>
                  <AccordionIcon color="white" />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4} color="gray.300" fontSize="sm" lineHeight="tall">
                <Text mb={2}>
                  Ved betaling af kontingent accepterer du følgende vilkår:
                </Text>
                <List spacing={2} ml={4}>
                  <ListItem>
                    • Medlemskabet gælder for den valgte periode og kan ikke opsiges i denne periode
                  </ListItem>
                  <ListItem>
                    • Medlemskabet udløber automatisk ved periodens afslutning uden yderligere forpligtelser
                  </ListItem>
                  <ListItem>
                    • Betalt kontingent refunderes ikke, jf. foreningens vedtægter §5
                  </ListItem>
                  <ListItem>
                    • Som klubmedlem har du stemmeret på generalforsamlinger
                  </ListItem>
                </List>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>

        <Box borderWidth={'1px'} borderColor={'white'} borderRadius={'md'} p={4}>
          <Heading size="sm" color={'white'} mb={4}>Betal kontingent</Heading>
          {!isActiveClub && (
            <Text color={'white'} mb={4}>{coverageTextFromSelection}</Text>
          )}
          {isActiveClub && (
            <Text color={'white'} mb={4}>
              Du har betalt kontingent. Kontingentet udløber {expiryDateText}
            </Text>
          )}
          <Stack spacing={4} maxW={{ base: '100%', md: '720px' }}>
            <FormControl>
              <FormLabel color={'white'}>Vælg år</FormLabel>
              <HStack wrap="wrap" spacing={3}>
                {(settings?.paymentOptions || []).map((opt) => {
                  const coveredYears = new Set<number>((summary?.coveredYears || []) as number[])
                  const overlaps = (opt.coversYears || []).some((y) => coveredYears.has(Number(y)))
                  const isSelected = selectedOptionId === opt.id
                  return (
                    <Button
                      key={opt.id}
                      size="sm"
                      colorScheme={isSelected ? 'red' : 'gray'}
                      variant={isSelected ? 'solid' : 'outline'}
                      color={isSelected ? 'white' : 'white'}
                      borderColor={isSelected ? undefined : 'white'}
                      _hover={overlaps ? {} : (isSelected ? { opacity: 0.9 } : { bg: 'whiteAlpha.200' })}
                      onClick={() => {
                        if (overlaps) return
                        setSelectedOptionId((prev) => (prev === opt.id ? '' : opt.id))
                      }}
                      isDisabled={overlaps}
                    >
                      {(opt.label || opt.id) + (overlaps ? ' (allerede betalt)' : '')}
                    </Button>
                  )
                })}
              </HStack>
            </FormControl>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel color={'white'}>Fornavn</FormLabel>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} bg="white" color="black" />
              </FormControl>
              <FormControl>
                <FormLabel color={'white'}>Efternavn</FormLabel>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} bg="white" color="black" />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <Box display="flex" alignItems="center" gap={3} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                <Text color={'white'} fontWeight="bold" whiteSpace="nowrap">Vælg beløb (DKK)</Text>
                <Box flex="1" maxW={{ base: '100%', md: '420px' }}>
                  <Slider
                    min={settings?.minAmountDkk ?? 10}
                    max={settings?.maxAmountDkk ?? 100}
                    value={amount}
                    onChange={(v) => setAmount(v)}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </Box>
                <Text color={'white'} whiteSpace="nowrap">{amount} DKK</Text>
              </Box>
            </FormControl>

            <HStack>
              <Button onClick={startCheckout} isLoading={loading} colorScheme="red">Betal</Button>
            </HStack>
          </Stack>
        </Box>
      </Stack>
    </Container>
  )
}

export default function MembershipPage() {
  return (
    <Suspense fallback={<LoadingSpinnerMemb/>}>
      <MembershipContent />
    </Suspense>
  )
}


