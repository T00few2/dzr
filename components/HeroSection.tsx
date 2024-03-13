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
        py={{ base: 0, md: 0 }}
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
          <Button as ='a' colorScheme='facebook' href='https://www.facebook.com/groups/358114378652929' target="_blank" borderRadius="full">
            <FaFacebook style={{ fontSize: '24px'}} />
          </Button>
          <Button as='a' bg='#7289da' href='https://discord.gg/6CZrD34cCv' target ='_blank'>
          <FaDiscord style={{ fontSize: '20px', color: 'white' }} />
          </Button>
        </Stack>
        
      </Stack>
    </Container>
  )
}