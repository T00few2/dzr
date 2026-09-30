import { Container, Heading, Text } from '@chakra-ui/react'
import Link from 'next/link'

export default function IntervalsConnectedPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={6}>
        intervals.icu er forbundet
      </Heading>
      <Text color="gray.300" mb={4}>
        Gå tilbage til DZR Coach i Discord og spørg fx hvordan din uge var. Du behøver ikke logge
        ind her.
      </Text>
      <Text fontSize="sm" color="gray.500">
        <Link href="/members-zone/my-pages?tab=2" style={{ textDecoration: 'underline' }}>
          Mine sider
        </Link>
      </Text>
    </Container>
  )
}
