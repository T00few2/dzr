import RaceList from './ZwiftyFiftyRaceList';

import {
  Container,
  SimpleGrid,
  Image,
  Flex,
  Heading,
  Text,
  Stack,
} from '@chakra-ui/react'

import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'The Zwifty Fifty',
  description: 'DZR brings to you the Goldilocks of Zwift racing intensity and endurance. With weekly races at about 50km the races are not too short and intensive to build stamina and not too long and time consuming to actually get done. They are just right. And they are on every Sunday 14:45 CET | 8:45 AM EST.',

  metadataBase: new URL('https://www.dzrracingseries.com/the-zwifty-fifty/'),

  openGraph: {
    title: 'The Zwifty Fifty',
    description: 'DZR brings to you the Goldilocks of Zwift racing intensity and endurance. With weekly races at about 50km the races are not too short and intensive to build stamina and not too long and time consuming to actually get done. They are just right. And they are on every Sunday 14:45 CET | 8:45 AM EST.',
    url: 'https://www.dzrracingseries.com/the-zwifty-fifty/',
    siteName: 'DZR',
    images: [
      {
        url: '/general/TZF_logo.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  }
}

export default function thezwiftyfiftypage() {
  
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
        <Flex>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/the-zwifty-fifty/general/TZF_logo.png'
              }
              objectFit={'contain'}
            />
          </Flex>
          <Stack spacing={4}>
            <RaceList/>
          </Stack>
          
        </SimpleGrid>
      </Container>
    </div>
  )
}