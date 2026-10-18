'use client'

import { ExternalLinkIcon } from '@chakra-ui/icons'
import {
  Container,
  Heading,
  Image,
  Link as ChakraLink,
  List,
  ListItem,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { RouteProfilePreview } from '@/components/route-profile/RouteProfilePreview'
import type { CatalogRoute } from '@/app/lib/catalogRoute'

type RaceStart = { time: string; eventId: string }

export type SeriesRaceView = {
  date: string
  label: string
  routeName: string
  route: CatalogRoute | null
  starts: RaceStart[]
}

export type SeriesPageData = {
  slug: string
  name: string
  intro: string
  timeLabel: string
  kind: 'weekly' | 'limited'
  logoUrl: string
  rules: string[]
  pointsNote: string
  pointsRows: { label: string; points: string }[]
  leagueUrl: string
  schedule: SeriesRaceView[]
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function RaceLinks({ starts }: { starts: RaceStart[] }) {
  const linked = starts.filter((start) => start.eventId)
  if (!linked.length) return <Text color="white">Zwift event not published yet</Text>
  return (
    <Stack spacing={1}>
      {linked.map((start) => (
        <Text key={start.eventId} color="white">
          {start.time ? `${start.time} ` : ''}
          <ChakraLink color="orange.300" href={`https://www.zwift.com/eu/events/view/${start.eventId}`} isExternal>
            Zwift <ExternalLinkIcon mx="2px" />
          </ChakraLink>
          {' · '}
          <ChakraLink color="orange.300" href={`https://zwiftpower.com/events.php?zid=${start.eventId}`} isExternal>
            ZwiftPower <ExternalLinkIcon mx="2px" />
          </ChakraLink>
        </Text>
      ))}
    </Stack>
  )
}

function RaceProfile({ route }: { route: CatalogRoute }) {
  const bonus = route.sprints
    .map((name, index) => ({ name: name.trim(), laps: (route.sprintLaps[index] || '').trim() }))
    .filter((row) => row.name)
  return (
    <Stack spacing={3}>
      <Text color="white">World: {route.world}</Text>
      <Text color="white">
        Route:{' '}
        {route.linkRoute ? (
          <ChakraLink color="orange.300" href={route.linkRoute} isExternal>
            {route.route} <ExternalLinkIcon mx="2px" />
          </ChakraLink>
        ) : (
          route.route
        )}
      </Text>
      <Text color="white">Laps: {route.laps}</Text>
      <Text color="white">Distance: {route.distance} km</Text>
      <Text color="white">Elevation: {route.elevation} hm</Text>
      {route.finish ? <Text color="white">Finish: {route.finish}</Text> : null}
      <RouteProfilePreview
        request={{
          world: route.world,
          route: route.zwiftRouteName || route.route,
          laps: route.laps,
          distance: route.distance,
          finish: route.finish,
          climbs: route.climbs,
          customClimbs: route.customClimbs,
        }}
        showClimbs={route.climbs.length + route.customClimbs.length > 0}
        bonusSprints={bonus}
      />
      {bonus.length ? (
        <TableContainer>
          <Table size="sm" color="white">
            <Thead>
              <Tr>
                <Th color="white">Segment</Th>
                <Th color="white">Laps</Th>
                <Th color="white">Bonus seconds</Th>
              </Tr>
            </Thead>
            <Tbody>
              {bonus.map((row, index) => (
                <Tr key={`${row.name}-${index}`}>
                  <Td>{row.name}</Td>
                  <Td>{row.laps}</Td>
                  <Td>{route.bonus[index] || ''}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      ) : null}
    </Stack>
  )
}

export default function SeriesView({ series }: { series: SeriesPageData }) {
  const today = todayIso()
  const next = series.schedule.find((race) => race.date >= today) || series.schedule[0]
  return (
    <Container maxW={{ base: '90%', md: '5xl' }} py={0} mb={20}>
      <Stack spacing={6}>
        {series.logoUrl ? <Image src={series.logoUrl} alt="" maxH="220px" objectFit="contain" /> : null}
        <Heading color="white">{series.name}</Heading>
        {series.intro ? (
          <Text color="white" whiteSpace="pre-line">
            {series.intro}
          </Text>
        ) : null}
        {series.timeLabel ? <Heading size="md" color="white">{series.timeLabel}</Heading> : null}
        {series.rules.length ? (
          <List spacing={2} color="white">
            {series.rules.map((rule) => (
              <ListItem key={rule}>{rule}</ListItem>
            ))}
          </List>
        ) : null}
        {series.kind === 'limited' ? (
          <TableContainer>
            <Table size="sm" color="white">
              <Thead>
                <Tr>
                  <Th color="white">Date</Th>
                  <Th color="white">Race</Th>
                  <Th color="white">Route</Th>
                  <Th color="white">Laps</Th>
                  <Th color="white">Km</Th>
                  <Th color="white">Hm</Th>
                  <Th color="white">Zwift</Th>
                </Tr>
              </Thead>
              <Tbody>
                {series.schedule.map((race) => (
                  <Tr key={`${race.date}-${race.routeName}-${race.label}`}>
                    <Td>{race.date}</Td>
                    <Td>{race.label || race.routeName}</Td>
                    <Td>
                      {race.route?.linkRoute ? (
                        <ChakraLink color="orange.300" href={race.route.linkRoute} isExternal>
                          {race.routeName}
                        </ChakraLink>
                      ) : (
                        race.routeName
                      )}
                    </Td>
                    <Td>{race.route?.laps || ''}</Td>
                    <Td>{race.route?.distance || ''}</Td>
                    <Td>{race.route?.elevation || ''}</Td>
                    <Td>
                      <RaceLinks starts={race.starts} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        ) : null}
        {next?.route ? (
          <Stack spacing={3}>
            <Heading size="md" color="white">
              {next.label || next.date}
            </Heading>
            <RaceLinks starts={next.starts} />
            <RaceProfile route={next.route} />
          </Stack>
        ) : (
          <Text color="gray.400">The next route has not been set.</Text>
        )}
        {series.pointsRows.length ? (
          <Stack spacing={2}>
            <Heading size="md" color="white">Points</Heading>
            {series.pointsNote ? <Text color="white">{series.pointsNote}</Text> : null}
            <TableContainer>
              <Table size="sm" color="white">
                <Tbody>
                  {series.pointsRows.map((row) => (
                    <Tr key={`${row.label}-${row.points}`}>
                      <Td>{row.label}</Td>
                      <Td>{row.points}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
            {series.leagueUrl ? (
              <Text color="white">
                Results:{' '}
                <ChakraLink color="orange.300" href={series.leagueUrl} isExternal>
                  ZwiftPower <ExternalLinkIcon mx="2px" />
                </ChakraLink>
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Container>
  )
}
