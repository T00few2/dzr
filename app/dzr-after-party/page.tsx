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

export default function dzrafterpartypage() {
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={'5xl'} py={12}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
          <Stack spacing={4}>
            <Text
              textTransform={'uppercase'}
              color={'white'}
              fontWeight={800}
              fontSize={'large'}
              bg={('red.600')}
              p={2}
              alignSelf={'flex-start'}
              rounded={'md'}>
              DZR After Party Series
            </Text>
            <Heading color={'white'}>Thursdays 17:15 CET | 11:15 AM EST</Heading>
            <Text color={'white'} fontSize={'lg'}>
                  A weekly race series with carefully selected routes all finishing uphill (aka after parties). Check out the coming race below and study the profile to know when to start the sprint. Use Zwift link to join race. Race calendar in menu.

            </Text>
            
          </Stack>
          <Flex>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/dzr-after-party/general/DAP_logo.png'
              }
              objectFit={'contain'}
            />
          </Flex>
        </SimpleGrid>
      </Container>
    </div>
  )
}