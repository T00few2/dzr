'use client'

import {
  Flex,
  Container,
  Heading,
  Stack,
  Text,
  Button,
  Icon,
  IconProps,
} from '@chakra-ui/react'

export default function HeroSection() {
  return (
    <Container maxW={'5xl'}
    bg={('black')}>
      <Stack
        textAlign={'center'}
        align={'center'}
        spacing={{ base: 8, md: 10 }}
        py={{ base: 20, md: 10 }}
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
        
      </Stack>
    </Container>
  )
}