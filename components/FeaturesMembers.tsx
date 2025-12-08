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

import { FaTrophy } from "react-icons/fa6";
import { MdInsights } from "react-icons/md";
import { FaUserCircle } from "react-icons/fa";

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

export default function FeaturesMembers() {
  return (
    <>
      <Box>
        <SimpleGrid spacing={4} minChildWidth={'300px'} marginBlockEnd={4}>
          <CustomCard 
            href='members-zone/racing' 
            icon={FaTrophy} 
            heading='Racing' 
            text1='Race Calendar, DZR Racing Teams' 
            text2='and Team Management' 
          />
          <CustomCard 
            href='members-zone/stats-hub' 
            icon={MdInsights} 
            heading='Stats' 
            text1='Club Stats, rider comparisons' 
            text2='and performance tracking' 
          />
          <CustomCard 
            href='members-zone/my-pages' 
            icon={FaUserCircle} 
            heading='My Pages' 
            text1='Your profile and' 
            text2='membership settings' 
          />
        </SimpleGrid>
      </Box>
    </>
  )
}