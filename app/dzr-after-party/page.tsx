import AfterPartyRaceList from './AfterPartyRaceList';
import {formatNextThursday} from './nextThursday';

import {
  Container,
  SimpleGrid,
  Image,
  Flex,
  Heading,
  Text,
  Stack,
  Divider,
} from '@chakra-ui/react'
import { ReactElement } from 'react'

import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'DZR After Party Series',
  description: 'A weekly race series with carefully selected routes all finishing uphill (aka after parties).',

  metadataBase: new URL('https://www.dzrracingseries.com/dzr-after-party/'),

  openGraph: {
    title: 'DZR After Party Series',
    description: 'A weekly race series with carefully selected routes all finishing uphill (aka after parties).',
    url: 'https://www.dzrracingseries.com/dzr-after-party',
    siteName: 'DZR',
    images: [
      {
        url: '/general/DAP_logo.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  }
}

interface FeatureProps {
  text: string
  iconBg: string
  icon?: ReactElement
}

const Feature = ({ text, icon, iconBg }: FeatureProps) => {
  return (
    <Stack direction={'row'} align={'center'}>
      <Flex w={8} h={8} align={'center'} justify={'center'} rounded={'full'} bg={iconBg}>
        {icon}
      </Flex>
      <Text fontWeight={600}>{text}</Text>
    </Stack>
  )
}

export default function dzrafterpartypage() {
    
  return (
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
        <Flex>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/dzr-after-party/general/DAP_logo.png'
              }
              objectFit={'contain'}
            />
          </Flex>
          
            <AfterPartyRaceList/>
          
        </SimpleGrid>
      </Container>
  )
}