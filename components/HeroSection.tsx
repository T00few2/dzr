'use client'

import { DZR_slogan, DZR_logo } from '@/app/gasp'
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
  Button,
} from '@chakra-ui/react'

import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa'
import { ReactNode } from 'react'

const pulseShadow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(173, 26, 45, 0.7); }
  70% { box-shadow: 0 0 0 20px rgba(173, 26, 45, 0); }
  100% { box-shadow: 0 0 0 0 rgba(173, 26, 45, 0); }
`;



export default function HeroSection() {
  return (
    <Container maxW={'5xl'} px={{ base: 6, md: 8 }}>
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 6, sm: 7, md: 8 }}
        py={{ base: 0, sm: 0, md: 0 }}
      >


        <Heading
          lineHeight={'150%'}
          py={50}
          display={{ base: 'block', sm: 'block', md: 'block' }}><DZR_logo /></Heading>
        <Text color="gray.300" fontSize={{ base: 'md', md: 'lg' }} maxW="3xl">
          Danish Zwift Racers is a Danish online cycling club for e-cycling on Zwift and a member of Danmarks Cykle Union (DCU).
          We are active in DCU E-Serien, Zwift Racing League, ECRO, and Club Ladder and many other racing series on Zwift.
        </Text>
        <DZR_slogan />
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={'center'} pt={4}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              as={Link}
              href="/join"
              style={{ textDecoration: 'none' }}
              rounded={'full'}
              size={'lg'}
              fontWeight={'bold'}
              px={8}
              py={6}
              colorScheme={'none'}
              bg={'#ad1a2d'}
              color={'white'}
              animation={`${pulseShadow} 2s infinite`}
              transition={'background-color 0.2s ease'}
              _hover={{ bg: '#8a1524' }}
            >
              Join DZR
            </Button>
          </motion.div>
        </Stack>


      </Stack>
    </Container>
  )
}