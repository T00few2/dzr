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
import fs from 'fs'
import path from 'path'

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
        url: '/a-sunday-in-hell/oct25/Promo.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
}

export default function ASundayInHellPage() {
  const csvPath = path.join(process.cwd(), 'public', 'a-sunday-in-hell', 'oct25', 'data.txt')
  let rows: string[][] = []
  try {
    const file = fs.readFileSync(csvPath, 'utf-8')
    const lines = file.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0)
    // CSV with semicolon separator; skip header
    rows = lines.slice(1).map(line => line.split(';').map(c => c.trim()))
  } catch {}
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
          <Flex>
            <Image
              rounded={'md'}
              alt={'A Sunday in Hell with DZR'}
              src={'/a-sunday-in-hell/oct25/Promo.png'}
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
                    <Th textAlign="center" textColor={'white'}>Race</Th>
                    <Th textAlign="center" textColor={'white'}>Race Pass</Th>
                    <Th textAlign="center" textColor={'white'}>World</Th>
                    <Th textAlign="center" textColor={'white'}>Route</Th>
                    <Th textAlign="center" textColor={'white'}>Laps</Th>
                    <Th textAlign="center" textColor={'white'}>Km</Th>
                    <Th textAlign="center" textColor={'white'}>Hm</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((cols, idx) => {
                    const race = cols[0]
                    const racePass = cols[1]
                    const world = cols[2]
                    const route = cols[3]
                    const routeLink = cols[4]
                    const laps = cols[5]
                    const km = cols[6]
                    const hm = cols[7]
                    const isTotal = race?.toLowerCase() === 'total'
                    return (
                      <Tr key={idx}>
                        <Td textAlign="center">{race}</Td>
                        <Td textAlign="center">
                          {!isTotal && racePass ? (
                            <Link color={'orange'} href={`https://www.zwift.com/events/view/${racePass}`} target='_Blank' isExternal>
                              Race Pass
                            </Link>
                          ) : ''}
                        </Td>
                        <Td textAlign="center">{world}</Td>
                        <Td textAlign="center">
                          {routeLink ? (
                            <Link color={'orange'} href={routeLink} target='_Blank' isExternal>{route}</Link>
                          ) : route}
                        </Td>
                        <Td textAlign="center">{isTotal ? '' : laps}</Td>
                        <Td textAlign="center">{km}</Td>
                        <Td textAlign="center">{hm}</Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'2xl'}>Route Profiles</Heading>
            <Carousel
              cards={[
                '/a-sunday-in-hell/oct25/The%20iTT.png',
                '/a-sunday-in-hell/oct25/The%20Sprint.png',
                '/a-sunday-in-hell/oct25/The%20After%20Party.png',
                '/a-sunday-in-hell/oct25/The%20Climb.png',
              ]}
            />

            <Heading color={'white'} fontSize={'2xl'}>Point Structure</Heading>
            <Heading color={'white'} fontSize={'md'}>Most accumulated points in the four stages takes the overall win</Heading>
            <Heading color={'white'} fontSize={'md'}>Points in the stages are divided according to</Heading>

            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Points per race</Td>
                    <Td textAlign="center">60, 57, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 and 1 for everyone else</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'xl'}>The Sprint</Heading>
            <Text color={'white'} fontSize={'sm'}>The Sprint is a points race. The winner is the rider with the most points at the end of the race. Points are awarded on intermediate sprints (primes) and on the finish line. The points structure is as follows:</Text>
            <Heading color={'white'} fontSize={'sm'}>First Across Line (FAL) points are awarded on segments below</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead>
                  <Tr>
                    <Th textAlign="center" textColor={'white'}>Segment</Th>
                    <Th textAlign="center" textColor={'white'}>Lap Banner</Th>
                    <Th textAlign="center" textColor={'white'}>Prime Sprint</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Laps</Td>
                    <Td textAlign="center">2 , 6</Td>
                    <Td textAlign="center">4 , 8</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'sm'}>Points on each prime are awarded according to</Heading>
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
                    <Th textAlign="center" textColor={'white'}>6</Th>
                    <Th textAlign="center" textColor={'white'}>7</Th>
                    <Th textAlign="center" textColor={'white'}>8</Th>
                    <Th textAlign="center" textColor={'white'}>9</Th>
                    <Th textAlign="center" textColor={'white'}>10</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Points</Td>
                    <Td textAlign="center">10</Td>
                    <Td textAlign="center">9</Td>
                    <Td textAlign="center">8</Td>
                    <Td textAlign="center">7</Td>
                    <Td textAlign="center">6</Td>
                    <Td textAlign="center">5</Td>
                    <Td textAlign="center">4</Td>
                    <Td textAlign="center">3</Td>
                    <Td textAlign="center">2</Td>
                    <Td textAlign="center">1</Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>

            <Heading color={'white'} fontSize={'sm'}>First Across Line (FAL) points are awarded on the finish line according to</Heading>
            <TableContainer  textAlign="center">
              <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Tbody>
                  <Tr>
                    <Td textAlign="center">Points</Td>
                    <Td textAlign="center">60, 57, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 and 1</Td>
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


