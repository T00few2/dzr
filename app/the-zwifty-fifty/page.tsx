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
} from '@chakra-ui/react'
import { IoAnalyticsSharp, IoLogoBitcoin, IoSearchSharp } from 'react-icons/io5'
import { ReactElement } from 'react'

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

            <Heading color={'white'}>Sundays 14:45 CET | 8:45 AM EST</Heading>
            <Text color={'white'} fontSize={'lg'}>
            When 25 is too little and 100 it too much.

            DZR brings to you the Goldilocks of Zwift racing intensity and endurance. With weekly races at about 50km the races are not too short and intensive to build stamina and not too long and time consuming to actually get done. They are just right. And they are on every Sunday 14:45 CET | 8:45 AM EST.

            </Text>
            
          </Stack>
        </SimpleGrid>
      </Container>
    </div>
  )
}