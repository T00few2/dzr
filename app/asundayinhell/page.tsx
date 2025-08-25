import {
  Container,
  SimpleGrid,
  Image,
  Flex,
  Heading,
  Text,
  Stack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Link,
} from '@chakra-ui/react'

import { Metadata } from 'next'
import Carousel from '../carousel'

export const metadata: Metadata = {
  title: 'A Sunday in Hell with DZR',
  description: 'Event page for A Sunday in Hell with DZR.',
  metadataBase: new URL('https://www.dzrracingseries.com/asundayinhell/'),
  openGraph: {
    title: 'A Sunday in Hell with DZR',
    description: 'Event page for A Sunday in Hell with DZR.',
    url: 'https://www.dzrracingseries.com/asundayinhell/',
    siteName: 'DZR',
    images: [
      {
        url: '/a-sunday-in-hell/sep25/Promo.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
}

export default function ASundayInHellPage() {
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
          <Flex>
            <Image
              rounded={'md'}
              alt={'A Sunday in Hell with DZR'}
              src={'/a-sunday-in-hell/sep25/Promo.png'}
              objectFit={'contain'}
              width="100%"
              height="auto"
            />
          </Flex>
          <Stack spacing={4}>
            <Heading color={'white'}>A Sunday in Hell with DZR</Heading>
            <Text color={'white'} fontSize={'lg'} whiteSpace="pre-line">
{`Welcome to A Sunday in Hell with DZR

Unleash your weekend warrior and take it to the limit in A Sunday in Hell with DZR — four back-to-back races designed to test every type of rider. The ultimate challenge.

Schedule
First Sunday of the month:
9:45 CET : The iTT (15 km) – for the time trialists
10:20 CET : The Sprint (20 km) – for the sprinters
11:00 CET : The After Party (15 km) – for the puncheurs
11:35 CET : The Climb (10 km) – for the climbers

Together that’s about 60 km and 1,000 hm => A Sunday in Hell!

Points are awarded for each stage, with the overall title going to the rider with the most accumulated points. Specialists can target stage wins, but will need to manage efforts carefully. All-rounders have a real shot at the overall, even if stage wins are out of reach. Expect pain, tactics, and plenty of fun from start to finish.`}
            </Text>

            <Heading color={'white'} fontSize={'2xl'}>Stages Overview</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead>
                  <Tr>
                    <Th textAlign="center" textColor={'white'}>Race Pass</Th>
                    <Th textAlign="center" textColor={'white'}>Time (CET)</Th>
                    <Th textAlign="center" textColor={'white'}>World</Th>
                    <Th textAlign="center" textColor={'white'}>Route</Th>
                    <Th textAlign="center" textColor={'white'}>Laps</Th>
                    <Th textAlign="center" textColor={'white'}>Km</Th>
                    <Th textAlign="center" textColor={'white'}>Hm</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center"><Link  color={'orange'} href='https://www.zwift.com/uk/events/view/0000001' target='_Blank' isExternal>Stage 1 - The iTT</Link></Td>
                    <Td textAlign="center">09:45</Td>
                    <Td textAlign="center">World TBD</Td>
                    <Td textAlign="center"><Link  color={'orange'} href='https://zwiftinsider.com/' target='_Blank' isExternal>Route TBD</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">15</Td>
                    <Td textAlign="center">200</Td>
                  </Tr>
                  <Tr>
                    <Td textAlign="center"><Link  color={'orange'} href='https://www.zwift.com/uk/events/view/0000002' target='_Blank' isExternal>Stage 2 - The Sprint</Link></Td>
                    <Td textAlign="center">10:20</Td>
                    <Td textAlign="center">World TBD</Td>
                    <Td textAlign="center"><Link  color={'orange'} href='https://zwiftinsider.com/' target='_Blank' isExternal>Route TBD</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">20</Td>
                    <Td textAlign="center">150</Td>
                  </Tr>
                  <Tr>
                    <Td textAlign="center"><Link  color={'orange'} href='https://www.zwift.com/uk/events/view/0000003' target='_Blank' isExternal>Stage 3 - The After Party</Link></Td>
                    <Td textAlign="center">11:00</Td>
                    <Td textAlign="center">World TBD</Td>
                    <Td textAlign="center"><Link  color={'orange'} href='https://zwiftinsider.com/' target='_Blank' isExternal>Route TBD</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">15</Td>
                    <Td textAlign="center">300</Td>
                  </Tr>
                  <Tr>
                    <Td textAlign="center"><Link  color={'orange'} href='https://www.zwift.com/uk/events/view/0000004' target='_Blank' isExternal>Stage 4 - The Climb</Link></Td>
                    <Td textAlign="center">11:35</Td>
                    <Td textAlign="center">World TBD</Td>
                    <Td textAlign="center"><Link  color={'orange'} href='https://zwiftinsider.com/' target='_Blank' isExternal>Route TBD</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">10</Td>
                    <Td textAlign="center">350</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'2xl'}>Route Profiles</Heading>
            <Carousel
              cards={[
                '/a-sunday-in-hell/sep25/The%20iTT.png',
                '/a-sunday-in-hell/sep25/The%20Sprint.png',
                '/a-sunday-in-hell/sep25/The%20After%20Party.png',
                '/a-sunday-in-hell/sep25/The%20Climb.png',
              ]}
            />

            <Heading color={'white'} fontSize={'2xl'}>Bonus Seconds</Heading>
            <Heading color={'white'} fontSize={'xl'}>Stage 2 - The Sprint</Heading>
            <Heading color={'white'} fontSize={'sm'}>First Across Line (FAL) bonus seconds are awarded on segments below</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead>
                  <Tr>
                    <Th textAlign="center" textColor={'white'}>Segment</Th>
                    <Th textAlign="center" textColor={'white'}>Sprint Segment</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Laps</Td>
                    <Td textAlign="center">2 , 4</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'sm'}>Bonus seconds on each sprint are awarded according to</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead>
                  <Tr>
                    <Th textAlign="center" textColor={'white'}>Position</Th>
                    <Th textAlign="center" textColor={'white'}>1</Th>
                    <Th textAlign="center" textColor={'white'}>2</Th>
                    <Th textAlign="center" textColor={'white'}>3</Th>
                    <Th textAlign="center" textColor={'white'}>4</Th>
                    <Th textAlign="center" textColor={'white'}>5</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Bonus Seconds</Td>
                    <Td textAlign="center">10</Td>
                    <Td textAlign="center">8</Td>
                    <Td textAlign="center">6</Td>
                    <Td textAlign="center">4</Td>
                    <Td textAlign="center">2</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'xl'}>Stage 2, 3 & 4</Heading>
            <Heading color={'white'} fontSize={'sm'}>Bonus seconds are awarded to top 5 on the finish line according to</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead>
                  <Tr>
                    <Th textAlign="center" textColor={'white'}>Position</Th>
                    <Th textAlign="center" textColor={'white'}>1</Th>
                    <Th textAlign="center" textColor={'white'}>2</Th>
                    <Th textAlign="center" textColor={'white'}>3</Th>
                    <Th textAlign="center" textColor={'white'}>4</Th>
                    <Th textAlign="center" textColor={'white'}>5</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Bonus Seconds</Td>
                    <Td textAlign="center">10</Td>
                    <Td textAlign="center">8</Td>
                    <Td textAlign="center">6</Td>
                    <Td textAlign="center">4</Td>
                    <Td textAlign="center">2</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'2xl'}>Results</Heading>
            <Heading color={'white'} fontSize={'md'}>Keep track of your performance and progress throughout the series on : <Link  color={'orange'} href='https://zwiftpower.com/league.php?id=2887' target='_Blank' isExternal>ZwiftPower</Link></Heading>
          </Stack>
        </SimpleGrid>
      </Container>
    </div>
  )
}


