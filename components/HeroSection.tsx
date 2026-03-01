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

import { FaFacebook, FaTwitter, FaYoutube, FaDiscord } from 'react-icons/fa'
import { ReactNode } from 'react'

const pulseShadow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0.7); }
  70% { box-shadow: 0 0 0 20px rgba(88, 101, 242, 0); }
  100% { box-shadow: 0 0 0 0 rgba(88, 101, 242, 0); }
`;



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
          display={{ base: 'block', sm: 'block', md: 'block' }}><DZR_logo /></Heading>
        <DZR_slogan />
        <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={'center'} pt={4}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              as={Link}
              href='https://discord.gg/FBtCsddbmU'
              isExternal
              style={{ textDecoration: 'none' }}
              rounded={'full'}
              size={'lg'}
              fontWeight={'bold'}
              px={8}
              py={6}
              colorScheme={'none'}
              bg={'#5865F2'}
              color={'white'}
              animation={`${pulseShadow} 2s infinite`}
              transition={'background-color 0.2s ease'}
              _hover={{ bg: '#4752C4' }}
              leftIcon={<FaDiscord size="1.2em" />}
            >
              Join our Discord Community
            </Button>
          </motion.div>
        </Stack>


      </Stack>
    </Container>
  )
}