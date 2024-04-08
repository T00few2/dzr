import {
    Container,
    SimpleGrid,
    Image,
    Flex,
    Heading,
    Text,
    Stack,
} from '@chakra-ui/react'

import {formatNextSaturday} from './nextSaturday';

import InTheZoneList from './InTheZone2List';
import { ExternalLinkIcon } from '@chakra-ui/icons'

import { Metadata } from "next";

import { ChakraProvider } from '@chakra-ui/react';

import YouTubeEmbed from '../../components/VideoEmbed';

export const metadata: Metadata = {
  title: 'In The Zone 2',
  description: 'Structured zone 2 group workouts every Saturday.',

  metadataBase: new URL('https://www.dzrracingseries.com/in-the-zone-2/'),

  openGraph: {
    title: 'In The Zone 2',
    description: 'Structured zone 2 group workouts every Saturday.',
    url: 'https://www.dzrracingseries.com/in-the-zone-2/',
    siteName: 'DZR',
    images: [
      {
        url: '/general/ITZ2_logo.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  }
}

export default function inthezone2page() {
  const formattedDate = formatNextSaturday();
  const htmlContent = "<svg><circle cx='50' cy='50' r='40' fill='red' /></svg>";
  return (
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        
        <Flex mb={5}>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/in-the-zone-2/general/ITZ2_logo.png'
              }
              objectFit={'contain'}
            />
          </Flex>
          <Stack spacing={4}>
            <Heading size={{ base: 'lg', sm: 'xl', md: '2xl' }} color='white'>In The Zone 2 with DZR</Heading>
            <Text color={'white'} fontSize={'md'}>Work smarter to build your endurance, preserve peak power and recover faster with Zone 2 focused training. 
            Join the European morning or afternoon session taking place every Saturday starting April 6th. Stay tuned!</Text>
            
            <InTheZoneList nextDate={formattedDate}/>
          </Stack>
          
          <Flex py={5} justifyContent="center" alignItems="center" height="auto" borderWidth={1}>
          <YouTubeEmbed videoId='-6PDBVRkCKc'/>
          </Flex>
          
      </Container>
  )
}

