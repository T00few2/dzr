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
import { FaTrophy } from "react-icons/fa6";
import { MdCalendarMonth, MdInsights } from "react-icons/md";
import { BsShopWindow } from "react-icons/bs";
import { MdOutlineDirectionsBike } from "react-icons/md";
import { countItems } from '@/components/shop/countItems';
import { useState, useEffect } from 'react';

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
  const [totalQuantity, setTotalQuantity] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch total item counts from all users
        const total = await countItems();
        setTotalQuantity(total);
      } catch (error) {
        console.error('Error loading item counts:', error);
      } 
    };

    loadData();
  }, []);
  return (
<>
      <Box >
        <SimpleGrid spacing={4} minChildWidth={'300px'} marginBlockEnd={4}>
        <CustomCard href='members-zone/race-calendar' icon = {MdCalendarMonth} heading = 'Race Calendar' text1 = 'When we race' text2 = 'Join us'/>
        {/*<CustomCard href='members-zone/shop' icon = {BsShopWindow} heading = 'Shop' text1 = 'Get the DZR kit IRL' text2={`Suits & bibs orders: ${totalQuantity}/20`} />*/}
        {/*<CustomCard href='members-zone/dzr-team-race' icon = {MdOutlineDirectionsBike} heading = 'DZR Team Race' text1 = 'Join a team race' text2= 'and let the fun begin' />*/}
        <CustomCard href='members-zone/zrl' icon = {FaTrophy} heading = 'DZR Racing Teams' text1 = 'Overview of DZR teams across race series' text2= 'Find a race series and team that suits' />
        <CustomCard href='members-zone/stats' icon = {MdInsights} heading = 'Club Stats' text1 = 'Compare riders, ratings and power' text2= 'Time series and power graphs' />
        </SimpleGrid>
      </Box>
   </>
  )
}