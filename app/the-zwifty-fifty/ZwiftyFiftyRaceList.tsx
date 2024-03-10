import React from 'react';
import { ZwiftyFiftyRacesTemplate } from './ZwiftyFiftyRaces';
import { ZwiftyFiftyCalender } from './ZwiftyFiftyCalender';
import { ZwiftyFiftyRacesData } from './ZwiftyFiftyRaces';
import { formatNextSunday } from './nextSunday';

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
  } from '@chakra-ui/react'

  import { ExternalLinkIcon } from '@chakra-ui/icons'

interface RaceProps {
  nextDate: string;
}

function RaceList({ nextDate }: RaceProps) {
    const nextRace = ZwiftyFiftyCalender.filter(date => date.date === nextDate);
    const nextRouteName = nextRace.map((nextRace) =>(nextRace.route));
    const nextRouteDetails = ZwiftyFiftyRacesData.filter(race => nextRouteName.includes(race.route));

    return (
        <Stack spacing={6}>
            {nextRace.map((nextRace)=>(
                nextRouteDetails.map((nextRouteDetails)=>(
                    <Stack key={nextDate} spacing={6}>
                        <Heading as='h1' size ='lg' color={'white'}>{nextDate}</Heading>
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
                                <Td textAlign="center"><Link href = {`https://www.zwift.com/eu/events/view/${nextRace.raceID}`} target='_Blank' isExternal>Zwift<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center"><Link href = {`https://zwiftpower.com/events.php?zid=${nextRace.raceID}`} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center">{nextRouteDetails.world}</Td>
                                <Td textAlign="center"><Link href = {nextRouteDetails.linkRoute} target='_Blank' isExternal>{nextRouteDetails.route}<ExternalLinkIcon mx='2px' /></Link></Td>
                                <Td textAlign="center">{nextRouteDetails.laps}</Td>
                                <Td textAlign="center">{nextRouteDetails.length}</Td>
                                <Td textAlign="center">{nextRouteDetails.hm}</Td>
                                </Tr>    
                            </Tbody>
                            </Table>
                        </TableContainer>
                        <Heading as='h1' size ='lg' color={'white'}>Route Profile and Key Climbs</Heading>
                        <Heading as='h2' size ='lg' color={'white'}>{nextRouteDetails.route}</Heading>
                    </Stack>
                ))))}
        </Stack>
        
        
        

        
        
/*        <Stack spacing={6}>
            {races.map((race) =>(
                <Stack key={race.date} spacing={6}>
                <Heading as='h1' size ='lg' color={'white'}>{race.date}</Heading>
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
                        <Td textAlign="center"><Link href = {race.racePass} target='_Blank' isExternal>Zwift<ExternalLinkIcon mx='2px' /></Link></Td>
                        <Td textAlign="center"><Link href = {race.linkZP} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link></Td>
                        <Td textAlign="center">{race.world}</Td>
                        <Td textAlign="center"><Link href = {race.linkRoute} target='_Blank' isExternal>{race.route}<ExternalLinkIcon mx='2px' /></Link></Td>
                        <Td textAlign="center">{race.laps}</Td>
                        <Td textAlign="center">{race.length}</Td>
                        <Td textAlign="center">{race.hm}</Td>
                        </Tr>
                        
                    </Tbody>
                    </Table>
                </TableContainer>
                <Heading as='h1' size ='lg' color={'white'}>Route Profile and Key Climbs</Heading>
                <Heading as='h2' size ='lg' color={'white'}>{race.route}</Heading>
                </Stack>
            ))}
            

        </Stack>
*/        
    );
}

export default RaceList;