'use client'
import './css/Features.css'

import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Stack,
  Text,
  useColorModeValue,
  Link,
  Divider,
  Center,
  AbsoluteCenter,
  Circle,
  Card,
  CardBody,
  CardBodyProps,
  CardHeader,
  SimpleGrid,
  SimpleGridProps,
  keyframes,
  VStack,
} from '@chakra-ui/react'
import { IconType } from 'react-icons';

import { motion } from 'framer-motion';

import { LiaMountainSolid } from "react-icons/lia";
import { Im500Px } from "react-icons/im";
import { AiOutlineAim } from "react-icons/ai";
import { RiBoxingFill } from "react-icons/ri";
import { MdOutlineTimer } from "react-icons/md";



interface Props {
  href: string;
  icon: IconType;
  heading: string;
  text1: string;
  text2: string;
}

const CustomCard: React.FC<Props> = ({ href, icon, heading, text1, text2 }) => {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Card className='hover-animation' as={motion.div} height='100%' bg={'black'} borderWidth={{ base:'2px', sm: '3px', md:'4px'}} borderRadius="lg" borderColor={'white'}> 
        <CardHeader>
          <Flex justify="center" align="center" bg="white" borderRadius="full" p={2} width={{ base:'10', sm: '14', md:'16'}} height={{ base:'10', sm: '14', md:'16'}}>
            <Icon as={icon} boxSize={'90%'} color='black'/>
          </Flex>
        </CardHeader>
        <CardBody>
          <Stack align={'start'} spacing={5}>
            <Box mt={2}>
              <Heading size={['sm','sm','md']} color={'white'}>{heading}</Heading>
              <Text mt={1} fontSize={['small','medium','medium']} color={'white'} whiteSpace="pre-line" >
                {text1} <br/> {text2}
              </Text>
            </Box>
          </Stack>
        </CardBody>
      </Card>
    </Link>
  );
};

export default function Features() {
  return (
    <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}}  display="flex" 
    justifyContent="center" 
    alignItems="center" 
    flexDirection="column"
  >
      <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
        <Box position='relative' padding='10'>
          <Divider />
        </Box>
      </Stack>
      <Box width={'100%'}>
        <SimpleGrid spacing={4} templateColumns='repeat(auto-fill, minmax(280px, 1fr))' marginBlockEnd={4}>
        {/* <CustomCard href='puncheurs-summer-cup' icon = {RiBoxingFill} heading = 'Puncheurs Summer Cup' text1 = 'Puncheurs Summer Battle' text2= 'Tuesdays in June 19:20 CEST | 1:20 PM EDT' /> */}
        <CustomCard href='dzr-after-party' icon = {LiaMountainSolid} heading = 'DZR After Party Series' text1 = 'Uphill finishes' text2= 'Thursdays 17:15 CET | 11:15 AM EST' />
        <CustomCard href='stages' icon = {MdOutlineTimer} heading = 'STAGS by DZR' text1 = 'Stage racing done right' text2= 'Tuesdays 19:20 CET | 1:20 PM EST' />
        <CustomCard href='in-the-zone-2' icon = {AiOutlineAim} heading = 'In The Zone 2' text1 = 'Structured zone 2 group workouts' text2= 'Saturdays 9:30 CET & 14:30 CET' />
        <CustomCard href='the-zwifty-fifty' icon = {Im500Px} heading = 'The Zwifty Fifty' text1 = '50km (ish) races with sprints for bonus seconds' text2= 'Sundays 14:14 CET | 8:45 AM EST' />
        </SimpleGrid>
      </Box>
    </Container>
  )
}