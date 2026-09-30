import { Container, Heading } from '@chakra-ui/react'
import IntervalsPrivacyContent from '@/components/IntervalsPrivacyContent'

export default function IntervalsPrivacyPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={6}>
        Privatliv — DZR Coach og intervals.icu
      </Heading>
      <IntervalsPrivacyContent showBackLink />
    </Container>
  )
}
