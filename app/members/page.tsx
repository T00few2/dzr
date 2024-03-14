'use client'

import Image from "next/image";
import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import GoogleCalendarEmbed from "@/components/GoogleCalendar";

import { ColorModeScript } from '@chakra-ui/react'

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
    Circle,
    Square,
    Input,
    Grid,
    InputRightElement,
    InputGroup,
  } from '@chakra-ui/react'

const inter = Inter({ subsets: ['latin']})


import React, { useState } from 'react';

function ProtectedPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const handleLogin = () => {
    
    if (password === 'kode1234') {
      setAuthenticated(true);
    } else {
      alert('Incorrect password');
    }
  };
  const [show, setShow] = React.useState(false)
  const handleClick = () => setShow(!show)

  return authenticated ? (
    <div>
      <GoogleCalendarEmbed calendarId="138f1219bfbe08c3493a0457232fc30de6b6811c7bdcbf43c4ea14b84627135d%40group.calendar.google.com&ctz=Europe%2FCopenhagen"/>
    </div>
  ) : (
    <Container maxW={'5xl'} centerContent bg="black" p={6} borderRadius="md" h="80vh" display="flex" flexDirection="column" justifyContent="center">
        <Grid templateColumns="1fr" gap={4} justifyItems="left" alignItems="start">
      <Heading color="white" >Sign In</Heading>
      
      <Stack>
      <InputGroup size='md'>
      <Input width='xs' variant='filled' type={show ? 'text' : 'password'} placeholder='Password' bg={'white'} color={'grey'} value={password} onChange={(e) => setPassword(e.target.value)}/>
      <InputRightElement width='4.5rem'>
        <Button h='1.75rem' size='sm' onClick={handleClick} >
          {show ? 'Hide' : 'Show'}
        </Button>
      </InputRightElement>
      </InputGroup>
      <Button width = '20' onClick={handleLogin} background="rgba(173, 26, 45, 0.95)" color={'white'}>Login</Button>
      </Stack>
      </Grid>
    </Container>
  );
}

export default ProtectedPage;