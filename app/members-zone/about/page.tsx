'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Divider,
  Heading,
  HStack,
  Icon,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FaDiscord } from 'react-icons/fa';
import { FaTrophy } from 'react-icons/fa6';
import { FiArrowRight } from 'react-icons/fi';
import { MdDirectionsBike, MdPerson } from 'react-icons/md';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';

interface BoardMember {
  name: string;
  role: string;
  email?: string;
}

export default function AboutPage() {
  const { status } = useSession();
  const [membershipSettings, setMembershipSettings] = React.useState<{ minAmountDkk: number; maxAmountDkk: number } | null>(null);

  React.useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/membership/settings', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setMembershipSettings({
            minAmountDkk: data?.minAmountDkk ?? 10,
            maxAmountDkk: data?.maxAmountDkk ?? 100,
          });
        }
      } catch {
        // keep defaults
      }
    }
    fetchSettings();
  }, []);

  if (status === 'loading') {
    return <LoadingSpinnerMemb />;
  }

  const boardMembers: BoardMember[] = [
    { name: 'Christian Kjær', role: 'Formand (Chairman)' },
    { name: 'Nick Niebling', role: 'Kasserer (Treasurer)' },
    { name: 'Mik Endersen', role: 'Bestyrelsesmedlem (Board Member)' },
  ];

  const membershipAmount = membershipSettings
    ? `${membershipSettings.minAmountDkk}-${membershipSettings.maxAmountDkk} kr. årligt`
    : '...';

  return (
    <Container maxW="7xl" py={8}>
      <VStack spacing={12} align="stretch">

        {/* Zone 1 — Hero */}
        <Box textAlign="center">
          <Badge bg="#ad1a2d" color="white" px={3} py={1} borderRadius="full" mb={4}>
            Bliv medlem af DZR
          </Badge>
          <Heading color="white" size="2xl" mb={4}>
            Race. Træn. Fællesskab.
          </Heading>
          <Text color="gray.300" fontSize={{ base: 'md', md: 'lg' }} maxW="3xl" mx="auto">
            DZR er en almennyttig online cykelforening med fællesskab, træning og løb for ryttere i hele Danmark.
            Bliv en del af det voksende e-cykelfællesskab.
          </Text>
        </Box>

        {/* Zone 2 — Three benefit pillars */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
          <Box textAlign="center">
            <Icon as={FaTrophy} color="#ad1a2d" boxSize={8} mb={3} />
            <Heading size="sm" color="white" mb={2}>Løb & Racing</Heading>
            <Text color="gray.400" fontSize="sm">Organiserede løb (Zwift Racing League, DIRT Racing Series, Club Ladder, Zwift Ligaen,..), DCU Forårsliga og holdmiljø på Zwift</Text>
          </Box>
          <Box textAlign="center">
            <Icon as={FaDiscord} color="#ad1a2d" boxSize={8} mb={3} />
            <Heading size="sm" color="white" mb={2}>Discord Fællesskab</Heading>
            <Text color="gray.400" fontSize="sm">Aktiv community med koordinering af hold og events</Text>
          </Box>
          <Box textAlign="center">
            <Icon as={MdDirectionsBike} color="#ad1a2d" boxSize={8} mb={3} />
            <Heading size="sm" color="white" mb={2}>Træning</Heading>
            <Text color="gray.400" fontSize="sm">Strukturerede træningspas og zone 2-workouts for alle niveauer</Text>
          </Box>
        </SimpleGrid>

        {/* Zone 3 — Auth-aware CTA */}
        <Box borderWidth="1px" borderColor="gray.700" borderRadius="lg" bg="gray.900" p={{ base: 5, md: 8 }}>
          {status === 'authenticated' ? (
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={4}>
              <Button
                as="a"
                href="/members-zone/my-pages"
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
                Gå til Min Side
              </Button>
              <Button
                as="a"
                href="/members-zone"
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
                Members Zone
              </Button>
            </Stack>
          ) : (
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
                leftIcon={<FaDiscord size="1.2em" />}
              >
                Community Medlem (gratis)
              </Button>
            </Stack>
          )}
        </Box>

        {/* Zone 4 — Membership tier cards (info-only) */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Card bg="gray.800" borderColor="#ad1a2d" borderWidth="2px" h="full" overflow="hidden">
            <CardHeader>
              <Heading size="md" color="white">Klub Medlem</Heading>
              <Badge bg="#ad1a2d" color="white" mt={2}>{membershipAmount}</Badge>
            </CardHeader>
            <CardBody>
              <List spacing={2} color="white">
                <ListItem fontSize="sm">• Deltager i Discord-server</ListItem>
                <ListItem fontSize="sm">• Online fællesskab</ListItem>
                <ListItem fontSize="sm">• Betalt kontingent</ListItem>
                <ListItem fontSize="sm">• Stemmeret på generalforsamling</ListItem>
                <ListItem fontSize="sm">• Mulighed for DCU e-licens via DZR</ListItem>
                <ListItem fontSize="sm">• Adgang til DCU Forårsliga</ListItem>
                <ListItem fontSize="sm">• Støt DZR 🫶</ListItem>
              </List>
            </CardBody>
          </Card>

          <Card bg="gray.800" borderColor="#5865F2" borderWidth="2px" h="full" overflow="hidden">
            <CardHeader>
              <Heading size="md" color="white">Community Medlem</Heading>
              <Badge bg="#5865F2" color="white" mt={2}>Gratis</Badge>
            </CardHeader>
            <CardBody>
              <List spacing={2} color="white">
                <ListItem fontSize="sm">• Deltager i Discord-server</ListItem>
                <ListItem fontSize="sm">• Online fællesskab</ListItem>
                <ListItem fontSize="sm">• Gratis</ListItem>
                <ListItem fontSize="sm">• Ingen stemmeret</ListItem>
              </List>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Vilkår for medlemskab */}
        <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" bg="gray.900">
          <Accordion allowToggle>
            <AccordionItem border="none">
              <h2>
                <AccordionButton _hover={{ bg: 'gray.800' }} py={3} px={4}>
                  <Text flex="1" textAlign="left" color="gray.300" fontSize="sm">
                    Vilkår for medlemskab
                  </Text>
                  <AccordionIcon color="gray.400" />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={3} pt={1} px={4} color="gray.300" fontSize="xs" lineHeight="tall">
                <Text mb={2}>Ved betaling af kontingent accepterer du følgende vilkår:</Text>
                <List spacing={1} ml={4}>
                  <ListItem>• Medlemskabet gælder for den valgte periode og refunderes ikke ved opsigelse i denne periode</ListItem>
                  <ListItem>• Medlemskabet udløber automatisk ved periodens afslutning uden yderligere forpligtelser</ListItem>
                  <ListItem>• Betalt kontingent refunderes ikke, jf. foreningens vedtægter §5</ListItem>
                  <ListItem>• Medlemskabet fornyes ikke automatisk - du skal selv forny dit medlemskab ved periodens udløb</ListItem>
                  <ListItem>• Som klubmedlem har du stemmeret på generalforsamlinger</ListItem>
                </List>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>

        {/* Zone 5 — Organisatoriske oplysninger & vedtægter (collapsed) */}
        <Accordion allowToggle>
          <AccordionItem borderWidth="1px" borderColor="gray.700" borderRadius="lg" overflow="hidden">
            <h2>
              <AccordionButton bg="gray.900" _hover={{ bg: 'gray.800' }} py={4} px={6}>
                <Box flex="1" textAlign="left" color="white" fontWeight="semibold">
                  Organisatoriske oplysninger & vedtægter
                </Box>
                <AccordionIcon color="white" />
              </AccordionButton>
            </h2>
            <AccordionPanel bg="gray.900" px={6} pb={8}>
              <VStack align="stretch" spacing={6} mt={2}>

                {/* Org info */}
                <Box>
                  <Text color="white" fontSize="md" lineHeight="tall" mb={3}>
                    Danish Zwift Racers (DZR) er en almennyttig og non-profit online sportsforening med medlemmer fra hele Danmark.
                    Foreningen blev stiftet den 17. november 2025 med det formål at fremme e-cykling som sportsgren og socialt fællesskab i Danmark.
                  </Text>
                  <Text color="white" fontSize="md" lineHeight="tall" mb={3}>
                    DZR skaber rammer for træning, løb og fællesskab på virtuelle cykelplatforme.
                    Aktiviteter foregår primært online, men fysiske møder kan afholdes efter behov.
                    Foreningen er medlem af Danmarks Cykle Union (DCU).
                  </Text>
                  <Text color="gray.400" fontSize="sm">CVR: 46035771</Text>
                </Box>

                <Divider borderColor="gray.700" />

                {/* Board members */}
                <Box>
                  <Heading size="sm" color="gray.400" mb={4} textTransform="uppercase" letterSpacing="wider">
                    Bestyrelse
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                    {boardMembers.map((member, index) => (
                      <Box key={index} bg="gray.800" borderWidth="1px" borderColor="gray.700" borderRadius="md" p={3}>
                        <HStack mb={1}>
                          <MdPerson color="white" size={16} />
                          <Text color="white" fontWeight="semibold" fontSize="sm">{member.name}</Text>
                        </HStack>
                        <Text color="gray.400" fontSize="xs">{member.role}</Text>
                        {member.email && (
                          <Text color="blue.400" fontSize="xs" mt={1}>{member.email}</Text>
                        )}
                      </Box>
                    ))}
                  </SimpleGrid>
                  <Text color="gray.500" mt={3} fontSize="xs">Kontakt bestyrelsen via Discord</Text>
                </Box>

                <Divider borderColor="gray.700" />

                {/* Vedtægter */}
                <Box>
                  <Heading size="sm" color="gray.400" mb={4} textTransform="uppercase" letterSpacing="wider">
                    Vedtægter
                  </Heading>
                  <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
                    <CardBody>
                      <Accordion allowToggle>
                        <AccordionItem border="none">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§1 - Navn og hjemsted</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text>
                              Foreningens navn er Danish Zwift Racers (DZR). Foreningen er en almennyttig
                              og non-profit online sportsforening med hjemsted på Frederiksberg og med medlemmer fra hele Danmark. Foreningen
                              har CVR-nummer 46035771.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§2 - Formål</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Foreningens formål er at fremme e-cykling som sportsgren og socialt
                              fællesskab i Danmark. DZR skaber rammer for træning, løb og fællesskab
                              på virtuelle cykelplatforme.
                            </Text>
                            <Text>Aktiviteter foregår primært online, men fysiske møder kan afholdes efter behov.</Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§3 - Tilknytning</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Foreningen er medlem af Danmarks Cykle Union (DCU) og
                              følger DCU&apos;s love og bestemmelser.
                            </Text>
                            <Text>Foreningen har ingen øvrige organisatoriske tilknytninger.</Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§4 - Medlemskab</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Som medlem kan optages enhver person, der støtter foreningens formål.
                              Indmeldelse sker digitalt via foreningens officielle hjemmeside
                              www.dzrracingseries.com.
                            </Text>
                            <Text mb={2}>Der sondres mellem to medlemskategorier:</Text>
                            <List spacing={2} ml={4}>
                              <ListItem>
                                <strong>1. Klub medlemmer:</strong> har betalt kontingent, har stemmeret
                                og mulighed for DCU e-licens via DZR.
                              </ListItem>
                              <ListItem>
                                <strong>2. Community medlemmer:</strong> deltager i foreningens
                                Discord-server og online fællesskab, men uden stemmeret eller adgang til
                                DCU-aktiviteter.
                              </ListItem>
                            </List>
                            <Text mt={2}>Medlemskab er gyldigt, når kontingentet er betalt via foreningens hjemmeside.</Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§5 - Udmeldelse og eksklusion</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Udmeldelse sker digitalt via foreningens hjemmeside www.dzrracingseries.com.
                              Betalt kontingent refunderes ikke.
                            </Text>
                            <Text>
                              Et medlem kan ekskluderes, hvis det handler til skade for foreningen.
                              Eksklusion kan indbringes for den førstkommende generalforsamling til
                              endelig afgørelse.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§6 - Kontingent</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Kontingentets størrelse fastsættes én gang årligt på generalforsamlingen.
                              Kontingent opkræves digitalt for et år ad gangen.
                            </Text>
                            <Text>
                              Kontingentet dækker perioden 1. januar til 31. december og følger
                              DCU&apos;s licensår.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§7 - Generalforsamling</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Generalforsamlingen er foreningens højeste myndighed. Ordinær
                              generalforsamling afholdes én gang årligt - digitalt eller fysisk -
                              inden udgangen af marts.
                            </Text>
                            <Text mb={2}>Indkaldelse sker med mindst 14 dages varsel via e-mail og Discord.</Text>
                            <Text mb={2} fontWeight="bold">Dagsorden:</Text>
                            <List spacing={1} ml={4}>
                              <ListItem>1. Valg af dirigent</ListItem>
                              <ListItem>2. Bestyrelsens beretning</ListItem>
                              <ListItem>3. Godkendelse af regnskab</ListItem>
                              <ListItem>4. Fastsættelse af kontingent og budget</ListItem>
                              <ListItem>5. Indkomne forslag</ListItem>
                              <ListItem>6. Valg af bestyrelse</ListItem>
                              <ListItem>7. Valg af revisor</ListItem>
                              <ListItem>8. Eventuelt</ListItem>
                            </List>
                            <Text mt={2}>
                              Forslag skal være bestyrelsen i hænde senest 7 dage før. Hvert aktivt
                              medlem har én stemme. Beslutninger træffes ved simpelt flertal.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§8 - Ekstraordinær generalforsamling</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text>
                              Afholdes når bestyrelsen beslutter det, eller når mindst 1/5 af de aktive
                              medlemmer (Klub medlemmer) skriftligt kræver det. Indkaldes med samme varsel som ordinær
                              generalforsamling.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§9 - Bestyrelsen</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Bestyrelsen består af mindst 3 medlemmer valgt for ét år ad gangen.
                              Bestyrelsen konstituerer sig selv med formand, kasserer og menigt medlem.
                            </Text>
                            <Text mb={2}>
                              Møder kan afholdes digitalt. Bestyrelsen er beslutningsdygtig, når mindst
                              halvdelen af medlemmerne deltager.
                            </Text>
                            <Text>Beslutninger træffes ved simpelt flertal.</Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§10 - Økonomi og hæftelse</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text mb={2}>
                              Foreningens regnskabsår følger kalenderåret. Foreningen tegnes af formanden
                              og kassereren i forening.
                            </Text>
                            <Text mb={2}>
                              Medlemmer hæfter ikke personligt for foreningens forpligtelser - foreningen
                              hæfter alene med sin egen formue.
                            </Text>
                            <Text>Regnskabet revideres af en kritisk revisor valgt af generalforsamlingen.</Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§11 - Vedtægtsændringer</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text>
                              Ændringer af vedtægterne kræver, at 2/3 af de afgivne stemmer på en
                              generalforsamling stemmer for.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§12 - Opløsning</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text>
                              Beslutning om opløsning kræver 3/4 flertal på en ekstraordinær
                              generalforsamling. Eventuel formue skal tilfalde cykelsportslige eller
                              almennyttige formål og må ikke udbetales til medlemmerne.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem border="none" borderTop="1px" borderColor="gray.700">
                          <h2>
                            <AccordionButton _hover={{ bg: 'gray.800' }}>
                              <Box flex="1" textAlign="left" color="white" fontWeight="bold">§13 - Ikrafttræden</Box>
                              <AccordionIcon color="white" />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4} color="gray.300">
                            <Text>
                              Disse vedtægter er vedtaget på foreningens stiftende generalforsamling
                              den 17. november 2025.
                            </Text>
                          </AccordionPanel>
                        </AccordionItem>
                      </Accordion>

                      <Divider borderColor="gray.600" my={6} />
                      <Text color="gray.400" fontSize="sm">
                        Vedtaget på stiftende generalforsamling den 17. november 2025
                      </Text>
                    </CardBody>
                  </Card>
                </Box>

              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        {/* Zone 6 — Minimal footer */}
        <Box borderTop="1px solid" borderColor="gray.700" pt={6} textAlign="center">
          <Text color="gray.500" fontSize="sm">
            For spørgsmål eller mere information, kontakt os via Discord.
          </Text>
        </Box>

      </VStack>
    </Container>
  );
}
