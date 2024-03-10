'use client'
import { ZwiftyFiftyRacesData } from './ZwiftyFiftyRaces';
import RaceList from './ZwiftyFiftyRaceList';
import { formatNextSunday } from './nextSunday';

import {
  Container,
  SimpleGrid,
  Image,
  Flex,
  Heading,
  Text,
  Stack,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react'

import { MdBackHand, MdPowerOff } from 'react-icons/md'
import { FaSuperpowers,FaHeartCircleBolt } from "react-icons/fa6";
import { LuBike } from "react-icons/lu";

export default function thezwiftyfiftypage() {
  const formattedDate = formatNextSunday();
  const filteredRaces = ZwiftyFiftyRacesData.filter(race => race.date === formattedDate);
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={'5xl'} py={12}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
        <Flex>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/the-zwifty-fifty/general/TZF_logo.png'
              }
              objectFit={'contain'}
            />
          </Flex>
          <Stack spacing={4}>

            <Heading color={'white'}>The Zwifty Fifty</Heading>
            <Text color={'white'} fontSize={'lg'} whiteSpace="pre-line">
            When 25 is too little and 100 it too much. <br /><br />
            DZR brings to you the Goldilocks of Zwift racing intensity and endurance. With weekly races at about 50km the races are not too short and intensive to build stamina and not too long and time consuming to actually get done. They are just right. And they are on every Sunday 14:45 CET | 8:45 AM EST.
            </Text>
            <Heading color={'white'} fontSize={'2xl'}>Rules:</Heading>
            <List spacing={3} color={'white'} >
              <ListItem>
                <ListIcon as={MdBackHand} color='orange' fontSize={'20px'}/>
                Category Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={FaSuperpowers} color='green.500' fontSize={'20px'}/>
                Power Meter Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={FaHeartCircleBolt} color='red.500' fontSize={'20px'}/>
                Heart Rate Monitor Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={LuBike} color='white' fontSize={'20px'}/>
                No TT bikes Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={MdPowerOff} color='yellow' fontSize={'20px'}/>
                No PowerUps
              </ListItem>
            </List>
            <RaceList races={filteredRaces} />
          </Stack>
          
        </SimpleGrid>
      </Container>
    </div>
  )
}