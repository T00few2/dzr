'use client'

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
} from '@chakra-ui/react'
import { ExternalLinkIcon } from '@chakra-ui/icons'
import { IoAnalyticsSharp, IoLogoBitcoin, IoSearchSharp } from 'react-icons/io5'
import { ReactElement } from 'react'
import { MdCheckCircle, MdSettings, MdBackHand, MdPower } from 'react-icons/md'
import { FaSuperpowers,FaHeartCircleBolt } from "react-icons/fa6";
import { LuBike } from "react-icons/lu";


import {
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

interface FeatureProps {
  text: string
  iconBg: string
  icon?: ReactElement
}

const Feature = ({ text, icon, iconBg }: FeatureProps) => {
  return (
    <Stack direction={'row'} align={'center'}>
      <Flex w={8} h={8} align={'center'} justify={'center'} rounded={'full'} bg={iconBg}>
        {icon}
      </Flex>
      <Text fontWeight={600}>{text}</Text>
    </Stack>
  )
}

interface RaceProps {
  date: string
  racePass: string
  linkZP: string
  world: string
  linkRoute: string
  laps: string
  length: string
  hm: string
  route: string
}

const ZwiftyFiftyRace = ({ date, racePass, linkZP, world, linkRoute, laps, length, hm, route }: RaceProps) => {
  return (
    <Stack spacing={6}>
      <Heading as='h1' size ='lg' color={'white'}>{date}</Heading>
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
              <Td textAlign="center"><Link href = {racePass} target='_Blank' isExternal>Zwift<ExternalLinkIcon mx='2px' /></Link></Td>
              <Td textAlign="center"><Link href = {linkZP} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link></Td>
              <Td textAlign="center">{world}</Td>
              <Td textAlign="center"><Link href = {linkRoute} target='_Blank' isExternal>{route}<ExternalLinkIcon mx='2px' /></Link></Td>
              <Td textAlign="center">{laps}</Td>
              <Td textAlign="center">{length}</Td>
              <Td textAlign="center">{hm}</Td>
            </Tr>
            
          </Tbody>
        </Table>
      </TableContainer>
      <Heading as='h1' size ='lg' color={'white'}>Route Profile and Key Climbs</Heading>
      <Heading as='h1' size ='lg' color={'white'}>{route}</Heading>
    </Stack>
  )
}


export default function thezwiftyfiftypage() {
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
                <ListIcon as={MdPower} color='yellow' fontSize={'20px'}/>
                No PowerUps
              </ListItem>
            </List>

            <ZwiftyFiftyRace
             date={'Sunday March 10'}
             racePass={'https://www.zwift.com/eu/events/view/4258717'}
             linkZP={'https://zwiftpower.com/events.php?zid=4258717'}
             world = {'London'}
             linkRoute = {'https://zwiftinsider.com/route/the-london-pretzel/'}
             laps = {'1'}
             length = {'55.6'}
             hm = {'531'}
             route = {'The London Pretzel'}
            />
          </Stack>
        </SimpleGrid>
      </Container>
    </div>
  )
}