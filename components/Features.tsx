'use client'
import './css/Features.css'

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
  Card,
  CardBody,
  CardBodyProps,
  CardHeader,
  SimpleGrid,
  SimpleGridProps,
  keyframes,
} from '@chakra-ui/react'

import { motion } from 'framer-motion';

import { LiaMountainSolid } from "react-icons/lia";
import { Im500Px } from "react-icons/im";
import { AiOutlineAim } from "react-icons/ai";

export default function Features() {
  return (
    <Box p={0}>
      <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
      <Box position='relative' padding='10'>
        <Divider />

      </Box>
      </Stack>
      <Stack  spacing={4} as={Container} maxW={'3xl'} mt={12} mb={20}>
      <SimpleGrid spacing={8}  minChildWidth='250px' alignContent={'center'}>
      <Link href={'dzr-after-party'} style={{ textDecoration: 'none' }}>
          <Card className='hover-animation' as={motion.div} height='100%' bg={'black'} borderWidth="5px" borderRadius="lg" borderColor={'white'}> 
            <CardHeader>
              <Flex justify="center" align="center" bg="white" borderRadius="full" p={2} width={16} height={16}>
                <Icon as={LiaMountainSolid} w={10} h={10} color='black'/>
              </Flex>
            </ CardHeader>
            <CardBody>
                <Stack align={'start'} spacing={5}>
                    <Box mt={2}>
                    <Heading size="md" color={'white'}>DZR After Party Series</Heading>
                    <Text mt={1} fontSize={'sm'} color={'white'} whiteSpace="pre-line">
                    Uphill finishes <br/> Thursdays 17:15 CET | 11:15 AM EST
                    </Text>
                    </Box>
                </Stack>
            </CardBody>
          </Card>
          </Link>
          <Link href={'in-the-zone-2'} style={{ textDecoration: 'none' }}>
          <Card className='hover-animation' as={motion.div} height='100%' bg={'black'} borderWidth="5px" borderRadius="lg" borderColor={'white'}> 
          <CardHeader>
            <Flex justify="center" align="center" bg="white" borderRadius="full" p={2} width={16} height={16}>
              <Icon as={AiOutlineAim} w={10} h={10} color='black' />
            </Flex>
            </ CardHeader>
            <CardBody>
                <Stack align={'start'} spacing={5}>
                    <Box mt={2}>
                    <Heading size="md" color={'white'}>In The Zone 2</Heading>
                    <Text mt={1} fontSize={'sm'} color={'white'} whiteSpace="pre-line">
                    Structured zone 2 group workouts <br/> Saturdays 9:30 CET & 14:30 CET
                    </Text>
                    </Box>
                </Stack>
            </CardBody>
          </Card>
          </Link>
          <Link href={'the-zwifty-fifty'} style={{ textDecoration: 'none' }}>
          <Card className='hover-animation' as={motion.div} height='100%' bg={'black'} borderWidth="5px" borderRadius="lg" borderColor={'white'}> 
          <CardHeader>
            <Flex justify="center" align="center" bg="white" borderRadius="full" p={2} width={16} height={16}>
              <Icon as={Im500Px} w={10} h={10} color='black' />
            </Flex>
            </ CardHeader>
            <CardBody>
                <Stack align={'start'} spacing={5}>
                    <Box mt={2}>
                    <Heading size="md" color={'white'}>The Zwifty Fifty</Heading>
                    <Text mt={1} fontSize={'sm'} color={'white'} whiteSpace="pre-line">
                    50km (ish) races <br/> Sundays 14:14 CET | 8:45 AM EST
                    </Text>
                    </Box>
                </Stack>
            </CardBody>
          </Card>
          </Link>
      </SimpleGrid>
      </Stack>
    </Box>
  )
}