'use client'
import React from 'react';
import { AfterPartyRacesData } from './AfterPartyRaces';
import Carousel from '../carousel';
import {useRaceCalendarAPS} from '../api/google/googleSheetsData';


import {
    Heading,
    Text,
    Stack,
    Link,
    Divider,
    Spinner,
    Box
  } from '@chakra-ui/react'

import { ExternalLinkIcon } from '@chakra-ui/icons'
import { CalenderTemplate } from '../api/google/calendarTemplate';

export default function AfterPartyRaceList() {

    const { calendarDataAPS, loading } = useRaceCalendarAPS();

    // Handle loading state
    if (loading) {
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

    const nextRace = calendarDataAPS.filter(data => data.raceID !== '').slice(-1) as CalenderTemplate[]
    const nextRouteName = nextRace.map((nextRace) =>(nextRace.route));
    const nextRouteDetails = AfterPartyRacesData.filter(race => nextRouteName.includes(race.route));
    
    return (
        <Stack spacing={6}>
        
                {nextRace.map((nextRace)=>(
                nextRouteDetails.map((nextRouteDetails)=>(
                    
                    <Stack key={nextRace.date} spacing={6}>
                        <Text color={'white'} fontSize={'md'} align={'center'}>A weekly race series with carefully selected routes all finishing uphill (aka after parties).
                        Check out the coming race below and study the profile to know when to start the sprint. Use Zwift link to join race. Race calendar in menu. <br /><br />
                        Ride on!</Text>
                        <center>
                        <Divider width='50%'/>
                        <br />
                        <Heading as='h1' color={'white'}>{nextRace.date}</Heading>
                        <Heading color={'white'}>17:15 CET | 11:15 AM EST</Heading>
                        <br />
                        <Divider width='50%'/>
                        </center>
                        <center>
                            <Text color={'white'}>World: {nextRouteDetails.world}</Text>  
                            <Text color={'white'}>Route: {nextRouteDetails.route}</Text>  
                            <Text color={'white'}>Laps: {nextRouteDetails.laps}</Text>  
                            <Text color={'white'}>Distance: {nextRouteDetails.distance} km</Text>  
                            <Text color={'white'}>Elevation: {nextRouteDetails.elevation} hm</Text>  
                            <Text color={'white'}>Finish: {nextRouteDetails.finish}</Text>   
                            <Text color={'white'}>Route:{' '} 
                            <Link color={'orange'} href = {nextRouteDetails.linkRoute} target='_Blank' isExternal>{nextRouteDetails.route}<ExternalLinkIcon mx='2px' /></Link>  
                            </Text>
                            <Text color={'white'}>ZwiftPower:{' '}  
                            <Link color={'orange'} href = {`https://zwiftpower.com/events.php?zid=${nextRace.raceID}`} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link>                
                            </Text>
                            <Text color={'white'}>Race Pass:{' '}  
                            <Link color={'orange'} href = {`https://www.zwift.com/eu/events/view/${nextRace.raceID}`} target='_Blank' isExternal>Zwift<ExternalLinkIcon mx='2px' /></Link>                
                            </Text>
                            <br />
                            <Divider width='75%'/>
                            <br />
                            <Heading color={'white'}>Profiles</Heading>

                        </center>
                        
                        <Carousel
                            cards={[
                                `/dzr-after-party/${nextRouteDetails.route.toLowerCase().replace(/\s+/g, '-')}/${nextRouteDetails.route.split(' ').join('-')}-profile.png`,
                                `/dzr-after-party/${nextRouteDetails.route.toLowerCase().replace(/\s+/g, '-')}/${nextRouteDetails.route.split(' ').join('-')}-hm.png`,
                                `/dzr-after-party/${nextRouteDetails.route.toLowerCase().replace(/\s+/g, '-')}/${nextRouteDetails.route.split(' ').join('-')}-finish.png`,
                            ]}
   
                        />
                    </Stack>
                    
                ))))}
        </Stack>
    );
}

