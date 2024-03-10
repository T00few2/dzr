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
    <Box
      maxW={{ base: 'full', md: '275px' }}
      w={'full'}
      borderWidth="5px"
      borderRadius="lg"
      overflow="hidden"
      p={5}>
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
        <Button variant={'link'} colorScheme={'orange'} size={'sm'}>
          <Link href={href}>Learn more</Link>
        </Button>
      </Stack>
    </Box>
  )
}

export default function Features() {
  return (
    <Box p={0}>
      <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
      <Box position='relative' padding='10'>
        <Divider />
        <AbsoluteCenter bg='red' borderRadius='full' color={'white'} fontWeight={900} borderWidth={'10px'} borderColor={'red'} fontSize={{ base: 'm', sm: 'l', md: 'xl' }}>
            Active Race Series
        </AbsoluteCenter>
</Box>
      </Stack>

      <Container maxW={'5xl'} mt={12}>
        <Flex flexWrap="wrap" gridGap={20} justify="center">
          <Card
            heading={'DZR After Party Series'}
            icon={<Icon as={LiaMountainSolid} w={10} h={10} />}
            description={'Uphill finishes \n Thursdays 17:15 | 11:15 AM EST'}
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