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
} from '@chakra-ui/react'
import { IoAnalyticsSharp, IoLogoBitcoin, IoSearchSharp } from 'react-icons/io5'
import { ReactElement } from 'react'
import { MdCheckCircle, MdSettings, MdBackHand, MdPower } from 'react-icons/md'
import { FaSuperpowers,FaHeartCircleBolt } from "react-icons/fa6";
import { LuBike } from "react-icons/lu";

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
            <List spacing={3} color={'white'} fontSize={'20px'} >
              <ListItem>
                <ListIcon as={MdBackHand} color='orange' />
                Category Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={FaSuperpowers} color='green.500' />
                Power Meter Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={FaHeartCircleBolt} color='red.500' />
                Heart Rate Monitor Enforced
              </ListItem>
              {/* You can also use custom icons from react-icons */}
              <ListItem>
                <ListIcon as={LuBike} color='white'/>
                No TT bikes Enforced
              </ListItem>
              <ListItem>
                <ListIcon as={MdPower} color='yellow' />
                No PowerUps
              </ListItem>
            </List>
            <Heading color={'white'}>Sunday March 10</Heading>
          </Stack>
        </SimpleGrid>
      </Container>
    </div>
  )
}