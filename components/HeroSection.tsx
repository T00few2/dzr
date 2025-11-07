'use client'

import {DZR_slogan, DZR_logo} from '@/app/gasp'
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
    
    >
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 6, sm: 7, md: 8 }}
        py={{ base: 0, sm: 0, md: 0 }}
        >


        <Heading
          lineHeight={'150%'}
          py={50}
          display={{ base: 'block', sm: 'block', md: 'block' }}><DZR_logo/></Heading>
        <DZR_slogan />
        <Stack direction={'row'} spacing={6}>
        <Popover trigger='hover'>
          <PopoverTrigger>
            <Link href='https://www.facebook.com/groups/358114378652929' target="_blank" _hover={{ animation: 'pulseIcon ease-in-out 0.2s forwards'}}>
            <Circle className='rotate-animation' as={motion.div} size={{ base:'30px', sm: '40px', md:'50px'}} bg='#4267B2' color='white'>
            <FaFacebook size = '50%'/>
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
            <Circle className='rotate-animation' as={motion.div} size ={{ base:'30px', sm: '40px', md:'50px'}} bg='#5865F2' color='white'>
            <FaDiscord size = '60%'/>
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