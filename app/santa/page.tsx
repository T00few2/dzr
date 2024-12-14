import ZwiftyFiftyRules from '../the-zwifty-fifty/ZwiftyFiftyRules';
import Carousel from '../carousel';

import {
  Container,
  SimpleGrid,
  Image,
  Flex,
  Heading,
  Text,
  Stack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Link,
} from '@chakra-ui/react'

import { FaTree } from "react-icons/fa6";
import { GiPresent } from "react-icons/gi";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'The SANTA league',
  description: "DZR Christmas Special: Zwifting Home on Christmas. Get a head start on your New Year's resolution and boost your training during the holidays with the 5-stage neck-and-neck scratch races of the SANTA league.",

  metadataBase: new URL('https://www.dzrracingseries.com/santa/'),

  openGraph: {
    title: 'The SANTA league',
  description: "DZR Christmas Special: Zwifting Home on Christmas. Get a head start on your New Year's resolution and boost your training during the holidays with the 5-stage neck-and-neck scratch races of the SANTA league.",
    url: 'https://www.dzrracingseries.com/santa/',
    siteName: 'DZR',
    images: [
      {
        url: '/santa/santa.png',
      },
    ],
    type: 'website',
    locale: 'en_US',
  }
}

export default function santapage() {
  
  return (
    <div style={{backgroundColor:'black'}}>
      <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20}>
        <SimpleGrid columns={{ base: 1, md: 1 }} spacing={10}>
        <Flex>
            <Image
              rounded={'md'}
              alt={'feature image'}
              src={
                '/santa/santa.png'
              }
              objectFit={'contain'}
            />
          </Flex>
          <Stack spacing={4}>

            <Heading color={'white'}>The SANTA league</Heading>
            <Text color={'white'} fontSize={'lg'} whiteSpace="pre-line">
            DZR Christmas Special: Zwifting Home on Christmas.
            Get a head start on your New Year's resolution and boost your training during the holidays with the 5-stage neck-and-neck scratch races of the SANTA league:
            <br/> <br/>

            <Flex direction="column" justify="flex-start" gap="0">
              <Flex align="center">
                <Text textAlign="left" width="125px" fontWeight={'bold'}>December 27</Text>
                <Text textAlign="left" width="150px"></Text>
                <Text textAlign="center" width="25px" fontSize="xx-large" fontWeight={'bold'} color={'red'}>S</Text> {/* Align S vertically */}
                <Text textAlign="left" width="150px">hisa Shakedown</Text>
              </Flex>
              <Flex align="center">
              <Text textAlign="left" width="125px" fontWeight={'bold'}>December 28</Text>
                <Text textAlign="right" width="150px">Loopin Lav</Text>
                <Text textAlign="center" width="25px" fontSize="xx-large" fontWeight={'bold'} color={'red'}>A</Text> {/* Align A vertically */}
                <Text textAlign="left" width="150px"></Text>
              </Flex>
              <Flex align="center">
                <Text textAlign="left" width="125px" fontWeight={'bold'}>December 29</Text>
                <Text textAlign="right" width="150px"></Text>
                <Text textAlign="center" width="25px" fontSize="xx-large" fontWeight={'bold'} color={'red'}>N</Text> {/* Align A vertically */}
                <Text textAlign="left" width="300px">ew York KOM After Party</Text>
              </Flex>
              <Flex align="center">
                <Text textAlign="left" width="125px" fontWeight={'bold'}>December 30</Text>
                <Text textAlign="right" width="150px">Triple Twis</Text>
                <Text textAlign="center" width="25px" fontSize="xx-large" fontWeight={'bold'} color={'red'}>T</Text> {/* Align A vertically */}
                <Text textAlign="left" width="150px"></Text>
              </Flex>
              <Flex align="center">
                <Text textAlign="left" width="125px" fontWeight={'bold'}>December 31</Text>
                <Text textAlign="right" width="150px"></Text>
                <Text textAlign="center" width="25px" fontSize="xx-large" fontWeight={'bold'} color={'red'}>A</Text> {/* Align A vertically */}
                <Text textAlign="left" width="300px">ccelerate to Elevate</Text>
              </Flex>
            </Flex>
            <br/>
            Each stage is rideable at 9:20 AM UTC, 3:20 PM UTC, and 9:20 PM UTC. <br/>
            </Text>
            <Heading color={'white'} fontSize={'2xl'}>Rules</Heading>
            <ZwiftyFiftyRules />
            <Heading color={'white'} fontSize={'2xl'} mt={4}>Stages Overview & Race Passes</Heading>
            
            <TableContainer  textAlign="center">
                <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>
                <Thead >
                    <Tr>
                    <Th textAlign="center" textColor={'white'}>Date</Th>
                    <Th textAlign="center" textColor={'white'}>9:20 AM UTC</Th>
                    <Th textAlign="center" textColor={'white'}>3:20 PM UTC</Th>
                    <Th textAlign="center" textColor={'white'}>9:20 PM UTC</Th>
                    
                    <Th textAlign="center" textColor={'white'}>World</Th>
                    <Th textAlign="center" textColor={'white'}>Route</Th>
                    <Th textAlign="center" textColor={'white'}>Laps</Th>
                    <Th textAlign="center" textColor={'white'}>Km</Th>
                    <Th textAlign="center" textColor={'white'}>Hm</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    <Tr>
                    <Td textAlign="center">27</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678424' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678426' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678427' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center">Watopia</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://zwiftinsider.com/route/shisa-shakedown/' target='_Blank' isExternal>Shisa Shakedown</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">53.5</Td>
                    <Td textAlign="center">556</Td>
                    </Tr>    

                    <Tr>
                    <Td textAlign="center">28</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678428' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678430' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678431' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center">Watopia</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://zwiftinsider.com/route/loopin-lava/' target='_Blank' isExternal>Loopin Lava</Link></Td>
                    <Td textAlign="center">2</Td>
                    <Td textAlign="center">32.6</Td>
                    <Td textAlign="center">408</Td>
                    </Tr>    

                    <Tr>
                    <Td textAlign="center">29</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678432' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678436' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678437' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center">New York</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://zwiftinsider.com/route/nyc-kom-after-party/' target='_Blank' isExternal>New York KOM After Party</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">37</Td>
                    <Td textAlign="center">476</Td>
                    </Tr>   
                    <Tr>
                    <Td textAlign="center">30</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678438' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678442' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678443' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center">Watopia</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://zwiftinsider.com/route/triple-twist/' target='_Blank' isExternal>Triple Twist</Link></Td>
                    <Td textAlign="center">2</Td>
                    <Td textAlign="center">44.4</Td>
                    <Td textAlign="center">382</Td>
                    </Tr>  
                    <Tr>
                    <Td textAlign="center">31</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678444' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678445' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://www.zwift.com/uk/events/tag/dzrchristmasspecial/view/4678446' target='_Blank' isExternal>Race Pass</Link></Td>
                    <Td textAlign="center">Watopia</Td>
                    <Td textAlign="center"><Link  color={'orange'} href = 'https://zwiftinsider.com/route/accelerate-to-elevate/' target='_Blank' isExternal>Accelerate to Elevate</Link></Td>
                    <Td textAlign="center">1</Td>
                    <Td textAlign="center">43.5</Td>
                    <Td textAlign="center">1158</Td>
                    </Tr>    
                </Tbody>
                </Table>
            </TableContainer>
            <Heading color={'white'} fontSize={'2xl'} mt={4}>Route Profiles</Heading>
            <Carousel
              cards={[
                '/santa/stage1.png',
                '/santa/stage3.png',
                '/santa/stage5.png',
  
                  ]}
              />

            <Heading color={'white'} fontSize={'2xl'}>Point Structure</Heading>
            <Heading color={'white'} fontSize={'md'}>The best 4 stage results count in the general classification.</Heading>
            <Heading color={'white'} fontSize={'md'}>If you do more than one race per stage, the best result counts as the stage result for the general classification.</Heading>
            <Heading color={'white'} fontSize={'md'}>Points in the stages are divided according to</Heading>

            <TableContainer  textAlign="center">
                <Table size='sm' color={'white'} borderColor={'white'} border={'1px'}>

                <Tbody>
                <Tr>
                    <Td textAlign="left">Points per race</Td>
                    <Td textAlign="left">20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 and 1 for everyone else</Td>
                </Tr>    
                </Tbody>
                </Table>
            </TableContainer>
            <Heading color={'white'} fontSize={'2xl'}>Results</Heading>
            <Heading color={'white'} fontSize={'md'}>Keep track of your performance and progress throughout the series on : <Link  color={'orange'} href = 'https://zwiftpower.com/league.php?id=1978' target='_Blank' isExternal>ZwiftPower</Link></Heading>
            
          </Stack>
          
        </SimpleGrid>
      </Container>
    </div>
  )
}