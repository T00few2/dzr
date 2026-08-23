'use client';

import {
  Badge,
  Box,
  Button,
  Container,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FaDiscord, FaRoad } from 'react-icons/fa';
import { FaTrophy } from 'react-icons/fa6';
import { FiArrowRight } from 'react-icons/fi';
import { MdDirectionsBike } from 'react-icons/md';

export default function RacingPageContent() {
  return (
    <Container maxW="7xl" py={8}>
      <VStack spacing={12} align="stretch">
        <Box textAlign="center">
          <Badge bg="#ad1a2d" color="white" px={3} py={1} borderRadius="full" mb={4}>
            Klub-løb
          </Badge>
          <Heading color="white" size="2xl" mb={4}>
            Løb og hold hos DZR
          </Heading>
          <Text color="gray.300" fontSize={{ base: 'md', md: 'lg' }} maxW="3xl" mx="auto">
            Danish Zwift Racers stiller hold og giver klubmedlemmer adgang til organiserede serier på Zwift:
            DCU E-Serien, Zwift Racing League og Club Ladder.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Box
            id="dcu-e-serien"
            bg="gray.900"
            borderWidth="1px"
            borderColor="gray.700"
            borderRadius="lg"
            p={{ base: 5, md: 6 }}
          >
            <Icon as={FaRoad} color="#ad1a2d" boxSize={7} mb={3} />
            <Heading size="md" color="white" mb={3}>
              DCU E-Serien
            </Heading>
            <Text color="gray.300" fontSize="sm" mb={3}>
              DCU E-Serien er Danmarks Cykle Unions e-cyklingsserie på Zwift. Du skal være medlem af en DCU-klub
              for at køre med. DZR er en DCU-klub, så DZR-klubmedlemmer kan deltage.
            </Text>
            <Text color="gray.400" fontSize="sm" mb={4}>
              En DCU e-licens er ikke et krav for at køre DCU E-Serien.
            </Text>
            <Button
              as="a"
              href="https://www.dansk-ecykling.dk"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              color="white"
              borderColor="gray.500"
              _hover={{ bg: 'gray.800' }}
              size="sm"
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              Officiel side
            </Button>
          </Box>

          <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="lg" p={{ base: 5, md: 6 }}>
            <Icon as={FaTrophy} color="#ad1a2d" boxSize={7} mb={3} />
            <Heading size="md" color="white" mb={3}>
              Zwift Racing League
            </Heading>
            <Text color="gray.300" fontSize="sm" mb={3}>
              Alle DZR-medlemmer kan køre Zwift Racing League. DZR stiller hold, og du finder dit hold på Discord.
            </Text>
            <Text color="gray.400" fontSize="sm">
              Hold og ryttere mødes i kanalen Ryttergården, hvor ryttere søger hold og hold søger ryttere.
            </Text>
          </Box>

          <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" borderRadius="lg" p={{ base: 5, md: 6 }}>
            <Icon as={MdDirectionsBike} color="#ad1a2d" boxSize={7} mb={3} />
            <Heading size="md" color="white" mb={3}>
              Club Ladder
            </Heading>
            <Text color="gray.300" fontSize="sm" mb={3}>
              Alle DZR-medlemmer kan køre Club Ladder. Som med ZRL finder du dit hold på Discord.
            </Text>
            <Text color="gray.400" fontSize="sm">
              Ryttergården er stedet, hvor ryttere og hold matcher hinanden før sæsonen.
            </Text>
          </Box>
        </SimpleGrid>

        <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          <Heading size="sm" mb={3} textTransform="uppercase" letterSpacing="wider" color="gray.400">
            Ryttergården på Discord
          </Heading>
          <Text color="gray.300" mb={6}>
            Når du er medlem, mødes ryttere og hold i den dedikerede Discord-kanal Ryttergården. Der søger hold
            efter ryttere, og ryttere søger efter hold til ZRL og Club Ladder.
          </Text>
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={4}>
            <Button
              as="a"
              href="/join"
              bg="#ad1a2d"
              color="white"
              _hover={{ bg: '#8a1524' }}
              size="lg"
              py={7}
              flex={1}
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wide"
              fontSize="md"
              rightIcon={<FiArrowRight size="1.2em" />}
            >
              Bliv klubmedlem
            </Button>
            <Button
              as="a"
              href="https://discord.gg/FBtCsddbmU"
              target="_blank"
              rel="noopener noreferrer"
              bg="rgba(88, 101, 242, 0.95)"
              color="white"
              _hover={{ bg: '#4752C4' }}
              size="lg"
              py={7}
              flex={1}
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wide"
              fontSize="md"
              leftIcon={<FaDiscord />}
            >
              Discord
            </Button>
            <Button
              as="a"
              href="/about"
              variant="outline"
              color="white"
              borderColor="gray.500"
              _hover={{ bg: 'gray.800' }}
              size="lg"
              py={7}
              flex={1}
              borderRadius="0"
              textTransform="uppercase"
              letterSpacing="wide"
              fontSize="md"
            >
              Om DZR
            </Button>
          </Stack>
        </Box>
      </VStack>
    </Container>
  );
}
