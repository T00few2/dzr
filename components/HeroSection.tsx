'use client'

import DZR_slogan from '@/app/gasp'
import { motion } from 'framer-motion';
import './css/Hero.css'

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
  Image,
} from '@chakra-ui/react'

import { FaFacebook, FaTwitter, FaYoutube, FaDiscord } from 'react-icons/fa'
import { ReactNode } from 'react'

export default function HeroSection() {
  return (
    <Container maxW={'5xl'}
    bg={('black')}
    >
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 6, sm: 7, md: 8 }}
        py={{ base: 10, md: 10 }}
        >
        <div className="image-container">
  <Image width='75vw' src="/general/FRONT_logo.png" />
</div>

        <Heading
          fontSize={{ base: '2xl', sm: '4xl', md: '6xl' }}
          lineHeight={'110%'}
          textColor='white'>
          
          
          
        </Heading>
        <DZR_slogan />
        <Stack direction={'row'} spacing={6}>
        <Popover trigger='hover'>
          <PopoverTrigger>
            <Link href='https://www.facebook.com/groups/358114378652929' target="_blank" _hover={{ animation: 'pulseIcon ease-in-out 0.2s forwards'}}>
            <Circle className='rotate-animation' as={motion.div} size='50px' bg='#4267B2' color='white'>
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
            <Link href='https://discord.gg/FBtCsddbmU' target="_blank" _hover={{ animation: 'pulseIcon ease-in-out 0.2s forwards'}}>
            <Circle className='rotate-animation' as={motion.div} size='50px' bg='#5865F2' color='white'>
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