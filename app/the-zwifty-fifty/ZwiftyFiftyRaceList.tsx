import React from 'react';
import { ZwiftyFiftyRacesTemplate } from './ZwiftyFiftyRacesTemplate';

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
  races: ZwiftyFiftyRacesTemplate[];
}

function RaceList({ races }: RaceProps) {
    return (
        
        <Stack spacing={6}>
            {races.map((race) =>(
                <Stack spacing={6}>
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
                <Heading as='h1' size ='lg' color={'white'}>{race.route}</Heading>
                </Stack>
            ))}
            

        </Stack>
        
    );
}

export default RaceList;