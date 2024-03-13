'use client'

import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Stack,
  Text,
  useColorModeValue,
  Link,
  Divider,
  AbsoluteCenter,
  Circle,
} from '@chakra-ui/react'
import { ReactElement } from 'react'
import {
  FcAbout,
  FcAssistant,
  FcCollaboration,
  FcDonate,
  FcManager,
} from 'react-icons/fc'

import { LiaMountainSolid } from "react-icons/lia";
import { Im500Px } from "react-icons/im";

interface CardProps {
  heading: string
  description: string
  icon: ReactElement
  href: string
}

const Card = ({ heading, description, icon, href }: CardProps) => {
  return (
    <Link href={href}>
    <Box
      maxW={{ base: 'full', md: '275px' }}
      w={'full'}
      borderWidth="5px"
      borderRadius="lg"
      overflow="hidden"
      p={5}
      >
      <Stack align={'start'} spacing={5}>
        <Flex
          w={16}
          h={16}
          align={'center'}
          justify={'center'}
          rounded={'full'}
          bg={('white')}>
          {icon}
        </Flex>
        <Box mt={2}>
          <Heading size="md" color={'white'}>{heading}</Heading>
          <Text mt={1} fontSize={'sm'} color={'white'} whiteSpace="pre-line">
            {description}
          </Text>
        </Box>

      </Stack>
    </Box>
    </Link>
  )
}

export default function Features() {
  return (
    <Box p={0}>
      <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
      <Box position='relative' padding='10'>
        <Divider />
        <AbsoluteCenter>
        <Circle bg='#ad1a2d' borderRadius='full' color={'white'} fontWeight={900} borderWidth={{ base: '10px', sm: '15px', md: '15px' }} borderColor={'#ad1a2d'} fontSize={{ base: 'm', sm: 'l', md: 'xl' }}>
            Active Race Series
        </Circle>
        </AbsoluteCenter>
</Box>
      </Stack>

      <Container maxW={'5xl'} mt={12} mb={20}>
        <Flex flexWrap="wrap" gridGap={20} justify="center">
          <Card
            heading={'DZR After Party Series'}
            icon={<Icon as={LiaMountainSolid} w={10} h={10} />}
            description={'Uphill finishes \n Thursdays 17:15 CET | 11:15 AM EST'}
            href={'dzr-after-party'}
          />
          <Card
            heading={'The Zwifty Fifty'}
            icon={<Icon as={Im500Px} w={10} h={10} />}
            description={"50km (ish) races \n Sundays 14:14 CET | 8:45 AM EST"}
            href={'the-zwifty-fifty'}
          />
        </Flex>
      </Container>
    </Box>
  )
}