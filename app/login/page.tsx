// app/login/page.tsx

'use client'; // This line is essential for client components

import React, { useState, useContext } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Container,
  Heading,
  Text,
  Grid,
  InputGroup,
  InputRightElement,
  Input,
  Stack,
  Image,
  Flex,
  Button,
} from '@chakra-ui/react';
import ForgotPasswordModal from '@/components/auth/ForgotPasswordModel';
import SignUpModal from '@/components/auth/SignUpModal'; // Adjust the path as necessary

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login form submitted"); // Log form submission
    try {
      await login(email, password);
      console.log("Redirecting to Members Zone...");
      router.push('/members-zone'); // Redirect to members-zone
    } catch (error) {
      console.error("Login failed", error); // Log any errors during login
    }
  };
  
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);

  const handleSignUpRedirect = () => {
    router.push('/signup'); // Redirect to the signup page
  };

  return (
    <Container maxW={'5xl'} centerContent bg="black" p={4} borderRadius="md" h="80vh" display="flex" flexDirection="column" justifyContent="center">
      <Grid templateColumns="1fr" gap={4} justifyItems="left" alignItems="start">
        <Flex alignItems="center">
          <Image 
            boxSize="50px" 
            src="/general/DZR_logo.svg" 
            alt="DZR logo" 
            rounded="md"
            mr={4} 
          />
          <Heading color="white">Members Login</Heading>
        </Flex>

        <InputGroup size='md'>
          <Input width='xs' variant='filled' placeholder='Email' bg={'white'} color={'grey'} value={email} onChange={(e) => setEmail(e.target.value)} />
        </InputGroup>
        <InputGroup size='md'>
          <Input width='xs' variant='filled' type={show ? 'text' : 'password'} placeholder='Password' bg={'white'} color={'grey'} value={password} onChange={(e) => setPassword(e.target.value)} />
          <InputRightElement width='5.5rem'>
            <Button h='1.75rem' size='sm' onClick={handleClick}>
              {show ? 'Hide' : 'Show'}
            </Button>
          </InputRightElement>
        </InputGroup>
        <Flex gap={4}>
          <Button type='submit' width='20' onClick={handleSubmit} background="rgba(173, 26, 45, 0.95)" color={'white'}>Login</Button>
          <SignUpModal />
        </Flex>
        <ForgotPasswordModal /> {/* Include the modal here */}
      </Grid>
    </Container>
  );
}
