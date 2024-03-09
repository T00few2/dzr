'use client'

import {
  Box,
  chakra,
  Container,
  Stack,
  Text,
  useColorModeValue,
  VisuallyHidden,
} from '@chakra-ui/react'
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa'
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
      bg={('blue')}
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
        color: ('blue')
      }}>
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </chakra.button>
  )
}

export default function Testimonials() {
  return (
    <Box
      bg={('black')}
      color={('white')}>
      <Container
        as={Stack}
        maxW={'6xl'}
        py={10}
        direction={{ base: 'column', md: 'row' }}
        spacing={4}
        justify={{ base: 'center', md: 'center' }}
        align={{ base: 'center', md: 'center' }}>
        
        <Stack direction={'row'} spacing={6}>
          <SocialButton label={'Facebook'} href='https://www.facebook.com/groups/358114378652929'>
            <FaFacebook />
          </SocialButton>
        </Stack>
      </Container>
    </Box>
  )
}