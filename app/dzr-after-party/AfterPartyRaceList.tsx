'use client'
import React from 'react';
import { AfterPartyRacesTemplate } from './AfterPartyRaces';
import { AfterPartyCalender } from './AfterPartyCalender';
import { AfterPartyRacesData } from './AfterPartyRaces';
import { formatNextThursday } from './nextThursday';
import Carousel from '../carousel';


import {
    Container,
    SimpleGrid,
    Image,
    Flex,
    Heading,
    Text,
    Stack,
    StackDivider,
    Icon,
    useColorModeValue,
    List,
    ListItem,
    ListIcon,
    Box,
    Link,
    Table,
    Thead,
    Tbody,
    Tfoot,
    Tr,
    Th,
    Td,
    TableCaption,
    TableContainer,
    Center,
    Divider
  } from '@chakra-ui/react'

import { ExternalLinkIcon } from '@chakra-ui/icons'

import Slider from 'react-slick';

interface RaceProps {
  nextDate: string;
}


function AfterPartyRaceList({ nextDate }: RaceProps) {
    const nextRace = AfterPartyCalender.filter(date => date.date === nextDate);
    const nextRouteName = nextRace.map((nextRace) =>(nextRace.route));
    const nextRouteDetails = AfterPartyRacesData.filter(race => nextRouteName.includes(race.route));
    
    return (
        <Stack spacing={6}>
            {nextRace.map((nextRace)=>(
                nextRouteDetails.map((nextRouteDetails)=>(
                    <Stack key={nextDate} spacing={6}>
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

export default AfterPartyRaceList;