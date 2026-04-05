'use client'

import React from 'react'
import {
  Box,
  Button,
  Container,
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
} from '@chakra-ui/react'
import { track } from '@vercel/analytics'
import StepProgressHeader from '@/components/onboarding/StepProgressHeader'

type PaymentOption = { id: string; label?: string; coversYears?: number[] }
type SettingsResponse = { minAmountDkk: number; maxAmountDkk: number; paymentOptions: PaymentOption[] }
type OnboardingSessionResponse = { session: { steps?: { discordLinked?: boolean; paymentSucceeded?: boolean } } | null }
type OnboardingStatusResponse = { membershipAlreadyPaid?: boolean; coveredThroughYear?: number | null; zwiftId?: string | null }

export default function JoinPaymentPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [canPay, setCanPay] = React.useState(false)
  const [paymentDone, setPaymentDone] = React.useState(false)
  const [settings, setSettings] = React.useState<SettingsResponse | null>(null)
  const [amount, setAmount] = React.useState(50)
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [selectedOptionId, setSelectedOptionId] = React.useState('')
  const [message, setMessage] = React.useState<string>('')
  const [alreadyPaid, setAlreadyPaid] = React.useState(false)
  const [coveredThroughYear, setCoveredThroughYear] = React.useState<number | null>(null)
  const rangeText = React.useMemo(() => {
    const min = settings?.minAmountDkk
    const max = settings?.maxAmountDkk
    if (typeof min === 'number' && typeof max === 'number') {
      return `Kontingentet er valgfrit mellem ${min} og ${max} DKK.`
    }
    return ''
  }, [settings])

  React.useEffect(() => {
    let ignore = false
    async function load() {
      const [sRes, sessionRes, statusRes] = await Promise.all([
        fetch('/api/membership/settings', { cache: 'no-store' }),
        fetch('/api/onboarding/session', { cache: 'no-store' }),
        fetch('/api/onboarding/status', { cache: 'no-store' }),
      ])
      const session = (await sessionRes.json()) as OnboardingSessionResponse
      if (ignore) return
      setCanPay(Boolean(session?.session?.steps?.discordLinked))
      setPaymentDone(Boolean(session?.session?.steps?.paymentSucceeded))
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as OnboardingStatusResponse
        const paid = Boolean(statusData?.membershipAlreadyPaid)
        setAlreadyPaid(paid)
        setCoveredThroughYear(typeof statusData?.coveredThroughYear === 'number' ? statusData.coveredThroughYear : null)
        if (paid) {
          setPaymentDone(true)
          setMessage(
            typeof statusData?.coveredThroughYear === 'number'
              ? `Kontingent er allerede betalt (daekket til og med ${statusData.coveredThroughYear}).`
              : 'Kontingent er allerede betalt.'
          )
        }
      }

      if (sRes.ok) {
        const s = (await sRes.json()) as SettingsResponse
        if (ignore) return
        setSettings(s)
        const initial = Math.min(Math.max(50, Number(s.minAmountDkk || 10)), Number(s.maxAmountDkk || 100))
        setAmount(initial)
      }

      const ref = new URLSearchParams(window.location.search).get('checkoutReference')
      if (ref) {
        const confirmRes = await fetch(`/api/onboarding/payment/confirm?reference=${encodeURIComponent(ref)}`, { cache: 'no-store' })
        const confirmData = await confirmRes.json().catch(() => ({}))
        if (ignore) return
        if (confirmRes.ok && confirmData?.status === 'succeeded') {
          setPaymentDone(true)
          setMessage('Betaling bekræftet. Fortsæt til trin 3.')
          track('onboarding_step2_payment_succeeded')
        } else if (confirmData?.status === 'pending') {
          setMessage('Betalingen afventer stadig. Opdater siden om et øjeblik.')
        } else if (confirmData?.status === 'failed') {
          setMessage('Betalingen mislykkedes. Prøv igen.')
        }
      }

      setLoading(false)
      track('onboarding_step_view', { step: 'payment' })
    }
    load().catch(() => setLoading(false))
    return () => {
      ignore = true
    }
  }, [])

  async function startPayment() {
    try {
      setSaving(true)
      setMessage('')
      const fullName = `${firstName} ${lastName}`.trim()
      if (!fullName) throw new Error('Indtast fornavn og efternavn')
      if (!selectedOptionId) throw new Error('Vælg betalingsperiode')

      track('onboarding_step2_payment_started')
      const res = await fetch('/api/onboarding/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountDkk: amount, fullName, selectedOptionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke starte betaling')
      window.location.href = String(data?.url || '')
    } catch (err: any) {
      setMessage(err?.message || 'Kunne ikke starte betaling')
      setSaving(false)
      track('onboarding_step2_payment_failed')
    }
  }

  if (!canPay) {
    return (
      <Container maxW="4xl" py={10}>
        <Stack spacing={4}>
          <StepProgressHeader currentStep={2} />
          <Heading color="white">Bliv medlem af DZR - Trin 2 af 3</Heading>
          <Text color="gray.300">Gennemfoer trin 1 ved at logge ind med Discord først.</Text>
          <Button as="a" href="/join/discord" colorScheme="red">
            Gå til trin 1
          </Button>
        </Stack>
      </Container>
    )
  }

  return (
    <Container maxW="4xl" py={10}>
      <Stack spacing={6}>
        <StepProgressHeader currentStep={2} />
        <Heading color="white">Bliv medlem af DZR - Trin 2 af 3</Heading>
        <Text color="gray.300">
          Her kan du se din medlemsstatus og betale kontingent for at fortsætte indmeldelsen.
          {rangeText ? ` ${rangeText}` : ''}
        </Text>
        {message ? <Text color="orange.300">{message}</Text> : null}

        <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" bg="gray.900" p={4}>
          <Stack spacing={1}>
            <Text color="white" fontWeight="bold">Nuværende status</Text>
            {alreadyPaid ? (
              <Text color="green.300">
                Klubmedlem - kontingent betalt
                {typeof coveredThroughYear === 'number' ? ` (daekket til og med ${coveredThroughYear})` : ''}
              </Text>
            ) : (
              <Text color="gray.300">Ikke registreret som betalt klubmedlem endnu</Text>
            )}
          </Stack>
        </Box>

        {paymentDone ? (
          <Button as="a" href="/join/zwift-id" colorScheme="red" onClick={() => track('onboarding_step2_continue_to_step3')}>
            Fortsæt til trin 3
          </Button>
        ) : (
          <Box borderWidth="1px" borderColor="gray.700" borderRadius="md" bg="gray.900" p={5}>
            <Stack spacing={4}>
              <HStack>
                {(settings?.paymentOptions || []).map((opt) => (
                  <Button key={opt.id} variant={selectedOptionId === opt.id ? 'solid' : 'outline'} onClick={() => setSelectedOptionId(opt.id)} colorScheme="red">
                    {opt.label || opt.id}
                  </Button>
                ))}
              </HStack>
              <FormControl>
                <FormLabel color="white">Fornavn</FormLabel>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} bg="white" color="black" />
              </FormControl>
              <FormControl>
                <FormLabel color="white">Efternavn</FormLabel>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} bg="white" color="black" />
              </FormControl>
              <FormControl>
                <FormLabel color="white">Beløb ({amount} DKK)</FormLabel>
                <Slider min={settings?.minAmountDkk ?? 10} max={settings?.maxAmountDkk ?? 100} value={amount} onChange={setAmount}>
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </FormControl>
              <Button onClick={startPayment} isLoading={saving} colorScheme="red" isDisabled={loading}>
                Fortsæt til Vipps
              </Button>
            </Stack>
          </Box>
        )}

        <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" bg="gray.800">
          <Accordion allowToggle>
            <AccordionItem border="none">
              <h2>
                <AccordionButton _hover={{ bg: 'gray.700' }} py={3}>
                  <Text flex="1" textAlign="left" color="white" fontWeight="bold" fontSize="sm">
                    Vilkår for medlemskab
                  </Text>
                  <AccordionIcon color="white" />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4} color="gray.300" fontSize="sm" lineHeight="tall">
                <Text mb={2}>Ved betaling af kontingent accepterer du følgende vilkår:</Text>
                <Text mb={1}>• Medlemskabet gælder for den valgte periode og refunderes ikke ved opsigelse i perioden.</Text>
                <Text mb={1}>• Medlemskabet udløber automatisk ved periodens afslutning uden yderligere forpligtelser.</Text>
                <Text mb={1}>• Betalt kontingent refunderes ikke, jf. foreningens vedtægter §5.</Text>
                <Text>• Som klubmedlem har du stemmeret på generalforsamlinger.</Text>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>
      </Stack>
    </Container>
  )
}
