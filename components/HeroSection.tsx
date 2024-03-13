'use client'

import {
  Flex,
  Container,
  chakra,
  VisuallyHidden,
  Heading,
  Stack,
  Text,
  Button,
  Icon,
  IconProps,
  Circle,
  Square,
} from '@chakra-ui/react'

import { FaFacebook, FaTwitter, FaYoutube, FaDiscord } from 'react-icons/fa'
import { ReactNode } from 'react'

const SocialButton = ({
  children,
  label,
  href,
}: {
  children: ReactNode
  label: string
  href: string
}) => {
  return (
    <chakra.button
      bg={('#7289da')}
      rounded={'full'}
      w={10}
      h={10}
      cursor={'pointer'}
      as={'a'}
      href={href}
      display={'inline-flex'}
      alignItems={'center'}
      justifyContent={'center'}
      transition={'background 0.3s ease'}
      _hover={{
        bg: ('white'),
        color: ('#4267B2')
      }}>
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </chakra.button>
  )
}

export default function HeroSection() {
  return (
    <Container maxW={'5xl'}
    bg={('black')}>
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 8, md: 10 }}
        py={{ base: 10, md: 10 }}
        >
        <Heading
          
          fontSize={{ base: '3xl', sm: '4xl', md: '6xl' }}
          lineHeight={'110%'}
          textColor='white'>
          <Text>Danish Zwift Racers
          </Text>
        </Heading>
        <Text color={'white'} maxW={'3xl'} as='cite' fontSize={{ base: 'l', sm: 'xl', md: '2xl' }}>
          the pain in the peleton
        </Text>

        <Stack direction={'row'} spacing={6}>
          <Circle as='a' size='40px' bg='#4267B2' color='white'  href='https://www.facebook.com/groups/358114378652929' target="_blank">
          <FaFacebook />
          </Circle>
          <Circle as='a' size='40px' bg='#5865F2' color='white'  href='https://discord.gg/6CZrD34cCv' target="_blank">
          <FaDiscord />
          </Circle>

        </Stack>
   
        
      </Stack>
    </Container>
  )
}