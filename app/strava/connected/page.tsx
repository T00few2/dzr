import { Container, Heading, Text } from '@chakra-ui/react'
import Link from 'next/link'

export default function StravaConnectedPage() {
  return (
    <Container maxW="lg" py={{ base: 16, md: 24 }} color="white">
      <Heading size="lg" mb={4}>
        Strava er forbundet
      </Heading>
      <Text color="gray.300" mb={4}>
        Gå tilbage til Discord. Botten har sendt dig en DM — spørg om din træning der. Coaching sker aldrig i offentlige kanaler.
      </Text>
      <Text fontSize="sm" color="gray.500">
        Du kan afbryde forbindelsen under{' '}
        <Link href="/members-zone/my-pages/profile" style={{ textDecoration: 'underline' }}>
          Profile
        </Link>
        .
      </Text>
    </Container>
  )
}
