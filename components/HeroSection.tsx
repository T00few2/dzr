'use client'

import DZR_slogan from '@/app/gasp'
import { motion } from 'framer-motion';

import {
  Container,
  chakra,
  VisuallyHidden,
  Heading,
  Stack,
  Text,
  Circle,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverArrow,
  keyframes,
  Link,
} from '@chakra-ui/react'

import { FaFacebook, FaTwitter, FaYoutube, FaDiscord } from 'react-icons/fa'
import { ReactNode } from 'react'

const animationKeyframesPulse = keyframes`
  0% { transform: scale(1) rotate(0deg) translateY(-20px); border-radius: 100%; }
  45% { transform: scale(1) rotate(0deg) translateY(-20px); border-radius: 100%; }
  47% { transform: scale(0.95) rotate(0deg) translateY(-20px); border-radius: 100%; }
  50% { transform: scale(1.25) rotate(0deg) translateY(-20px); border-radius: 100%; }
  53% { transform: scale(0.85) rotate(0deg) translateY(-20px); border-radius: 100%; }
  55% { transform: scale(1) rotate(0deg) translateY(-20px); border-radius: 100%; }
  100% { transform: scale(1) rotate(0deg) translateY(-20px); border-radius: 100%; }
`;

const animationKeyframesRot = keyframes`
  0% { transform: scale(1) rotate(0deg); border-radius: 100%; }
  70% { transform: scale(1) rotate(0deg); border-radius: 100%; }
  100% { transform: scale(1) rotate(7200deg); border-radius: 100%; }
`;

const animationPulse = `${animationKeyframesPulse} linear 4s infinite`;
const animationRot = `${animationKeyframesRot} ease-in-out 15s infinite`;


export default function HeroSection() {
  return (
    <Container maxW={'5xl'}
    bg={('black')}>
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 6, sm: 7, md: 8 }}
        py={{ base: 10, md: 10 }}
        >
        <Heading
          fontSize={{ base: '2xl', sm: '4xl', md: '6xl' }}
          lineHeight={'110%'}
          textColor='white'>
          
          <Text as ={motion.div} style={{ display: 'inline-block' }} animation={animationPulse}>DANISH ZWIFT RACERS</Text>
          
        </Heading>
        <DZR_slogan />
        <Stack direction={'row'} spacing={6}>
        <Popover trigger='hover'>
          <PopoverTrigger>
            <Link href='https://www.facebook.com/groups/358114378652929' target="_blank" _hover={{ transform: 'scale(1.25)'}}>
            <Circle as={motion.div} animation={animationRot} size='50px' bg='#4267B2' color='white'>
            <FaFacebook fontSize = {25}/>
            </Circle>
            </Link>
          </PopoverTrigger>
          <PopoverContent>
              <PopoverArrow />
              <PopoverHeader color='#4267B2'>Join our Facebook Group!</PopoverHeader>
            </PopoverContent>
        </Popover>
         
        <Popover trigger='hover'>
          <PopoverTrigger>
            <Link href='https://discord.gg/FBtCsddbmU' target="_blank" _hover={{ transform: 'scale(1.25)'}}>
            <Circle as={motion.div} animation={animationRot} size='50px' bg='#5865F2' color='white'>
            <FaDiscord fontSize = {25}/>
            </Circle>
            </Link>
          </PopoverTrigger>
          <PopoverContent>
              <PopoverArrow />
              <PopoverHeader color='#5865F2'>Join our Discord Channel!</PopoverHeader>
            </PopoverContent>
        </Popover>
        </Stack>
   
        
      </Stack>
    </Container>
  )
}