'use client'
import React from 'react';
import { useRaceCalendarZF } from '../api/google/googleSheetsData';
import { ZwiftyFiftyRacesData } from './ZwiftyFiftyRaces';
import Carousel from '../carousel';
import { CalenderTemplate } from '../api/google/calendarTemplate';
import ZwiftyFiftyRules from './ZwiftyFiftyRules';

import {
    Heading,
    Stack,
    Link,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Center,
    Spinner,
    Text,
    Box
  } from '@chakra-ui/react'

import { ExternalLinkIcon } from '@chakra-ui/icons'

interface RaceProps {
  nextDate: string;
}

function RaceList() {
    const { calendarDataZF, loadingZF } = useRaceCalendarZF();

    // Handle loading state
    if (loadingZF) {
        return (
            <Box
              position="fixed"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              zIndex="9999"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
            >
              <Box
                width="100px" // Size of the spinner
                height="100px" // Size of the spinner
                borderRadius="50%"
                border="8px solid" // Outer border of the bike wheel
                borderColor="white"
                
                position="relative"
                display="flex"
                alignItems="center"
                justifyContent="center"
                overflow="hidden"
                animation="spin 1s linear infinite"
              >
                {/* Inner rim of the bike wheel */}
                <Box
                  width="60px"
                  height="60px"
                  borderRadius="50%"
                  border="0px solid" // Inner border
                  borderColor="orange.300"
                  position="absolute"
                />
                {/* Spokes */}
                {[...Array(12)].map((_, i) => (
                  <Box
                    key={i}
                    position="absolute"
                    width="2px"
                    height="40px"
                    backgroundColor="white"
                    transform={`rotate(${i * 30}deg)`}
                    top="50%"
                    left="50%"
                    transformOrigin="0 0"
                  />
                ))}
              </Box>
              <Text color="white" mt={4}>Loading race data...</Text>
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}
              </style>
            </Box>
        );
      }

    const nextRace = calendarDataZF.filter(data => data.raceID !== '').slice(-1) as CalenderTemplate[]
    const nextRouteName = nextRace.map((nextRace) =>(nextRace.route));
    const nextRouteDetails = ZwiftyFiftyRacesData.filter(race => nextRouteName.includes(race.route));
       
    return (
        <Stack spacing={6}>
            {nextRace.map((nextRace)=>(
                nextRouteDetails.map((nextRouteDetails)=>(
                    <Stack key={nextRace.date} spacing={6}>
                        <Heading color={'white'}>The Zwifty Fifty</Heading>
            <Text color={'white'} fontSize={'lg'} whiteSpace="pre-line">
            When 25 is too little and 100 is too much. <br /><br />
            DZR brings to you the Goldilocks of Zwift racing intensity and endurance. With weekly races at about 50km the races are not too short and intensive to build stamina and not too long and time consuming to actually get done. They are just right. And they are on every Sunday 14:45 CET | 8:45 AM EST.
            </Text>
            <Heading color={'white'} fontSize={'2xl'}>Rules:</Heading>

            <ZwiftyFiftyRules />

            
                        <Heading as='h1' size ='lg' color={'white'}>{nextRace.date}</Heading>
                        <Heading as='h2' size ='md' color={'white'}>14:45 CET | 8:45 AM EST</Heading>
                        <TableContainer  textAlign="center">
                            <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                            <Thead >
                                <Tr>
                                <Th textAlign="center" textColor={'white'}>Race Pass</Th>
                                <Th textAlign="center" textColor={'white'}>ZwiftPower</Th>
                                <Th textAlign="center" textColor={'white'}>World</Th>
                                <Th textAlign="center" textColor={'white'}>Route</Th>
                                <Th textAlign="center" textColor={'white'}>Laps</Th>
                                <Th textAlign="center" textColor={'white'}>Km</Th>
                                <Th textAlign="center" textColor={'white'}>Hm</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                <Tr>
                                <Td textAlign="center"><Link  color={'orange'} href = {`https://www.zwift.com/eu/events/view/${nextRace.raceID}`} target='_Blank' isExternal>Zwift<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center"><Link  color={'orange'} href = {`https://zwiftpower.com/events.php?zid=${nextRace.raceID}`} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center">{nextRouteDetails.world}</Td>
                                <Td textAlign="center"><Link  color={'orange'} href = {nextRouteDetails.linkRoute} target='_Blank' isExternal>{nextRouteDetails.route}<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center">{nextRouteDetails.laps}</Td>
                                <Td textAlign="center">{nextRouteDetails.length}</Td>
                                <Td textAlign="center">{nextRouteDetails.hm}</Td>
                                </Tr>    
                            </Tbody>
                            </Table>
                        </TableContainer>
                        <Heading as='h1' size ='lg' color={'white'}>Route Profile and Key Climbs</Heading>
                        <Heading as='h2' size ='lg' color={'white'}>{nextRouteDetails.route}</Heading>

                        <Carousel
                            cards={[
                                `/the-zwifty-fifty/${nextRouteDetails.route.toLowerCase().replace(/\s+/g, '-')}/${nextRouteDetails.route.split(' ').join('-')}-profile.png`,
                                ...nextRouteDetails.climbs.map(climb => `/the-zwifty-fifty/${nextRouteDetails.route.toLowerCase().replace(/\s+/g, '-')}/${climb.split(' ').join('-')}.png`)
                                    ]}
                        />
                        <Heading as='h1' size ='lg' color={'white'}>Bonus Sprints</Heading>
                        <Heading as='h2' size ='md' color={'white'}>First across line (FAL) bonus seconds on segments below</Heading>
                        <TableContainer  textAlign="center" gridTemplateColumns="auto auto auto">
                            <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                            <Thead >
                                <Tr>
                                <Th textAlign="left" textColor={'white'} borderRight={'1px solid white'} fontWeight={700}>Segment</Th>
                                {nextRouteDetails.sprints.map((sprint, index) => (
                                    <Th key={index} textAlign={'center'} textColor={'white'} borderRight={'1px solid white'} fontWeight={700}>{sprint}</Th>
                                ))}

                                </Tr>
                            </Thead>
                            <Tbody>
                                <Tr>
                                <Td textAlign="left" borderRight={'1px solid white'} fontWeight={700}>Laps</Td>
                                {nextRouteDetails.sprintLaps.map((laps, index) => (
                                    <Td key={index} textAlign="center" borderRight={'1px solid white'}>{laps}</Td>
                                ))}
                                </Tr>    
                            </Tbody>
                            </Table>
                        </TableContainer>

                        <Heading as='h2' size ='md' color={'white'}>Bonus seconds on each sprint are awarded according to</Heading>
                        <TableContainer  textAlign="center" gridTemplateColumns="auto auto auto auto">
                            <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                            <Thead >
                                <Tr>
                                <Th textAlign="left" textColor={'white'} borderRight={'1px solid white'} fontWeight={700}>Position</Th>
                                <Th textAlign="center" textColor={'white'} borderRight={'1px solid white'} fontWeight={700}>1</Th>
                                <Th textAlign="center" textColor={'white'} borderRight={'1px solid white'} fontWeight={700}>2</Th>
                                <Th textAlign="center" textColor={'white'}>3</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                <Tr>
                                <Td textAlign="left" borderRight={'1px solid white'} fontWeight={700}>Bonus</Td>
                                {nextRouteDetails.bonus.map((bonus, index) => (
                                    <Td key={index} textAlign="center" borderRight={'1px solid white'}>{bonus}s</Td>
                                ))}
                                </Tr>    
                            </Tbody>
                            </Table>
                        </TableContainer>
                    </Stack>
                ))))}
        </Stack>
    );
}

export default RaceList;