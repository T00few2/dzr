// app/login/page.tsx

'use client'; // This line is essential for client components

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  Heading,
  Text,
  Grid,
  Stack,
  Image,
  Flex,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react';
import { signIn } from 'next-auth/react';
import { FaDiscord } from 'react-icons/fa';

const REQUIRED_ROLE_ID = '1385216556166025347';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams?.get('error');
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);

  const handleSignInDiscord = async () => {
    await signIn('discord', { callbackUrl: '/members-zone' });
  };

  const showMissingRole = urlError === 'AccessDenied';

  useEffect(() => {
    if (showMissingRole) {
      setRoleModalOpen(true);
    }
  }, [showMissingRole]);

  return (
    <Container maxW={'5xl'} centerContent  p={4} borderRadius="md" h="80vh" display="flex" flexDirection="column" justifyContent="center">
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

        <Stack spacing={4}>
          <Text color="white" width='xs' textAlign='left'>
            Sign in with Discord. You must be a Verified Member on our Discord server to access the Members Zone.
          </Text>
          <Button onClick={handleSignInDiscord} leftIcon={<FaDiscord />} background="rgba(88, 101, 242, 0.95)" color={'white'} width='xs'>
            Sign in with Discord
          </Button>
          <Text color="white" width='xs' textAlign='left'>Not a member yet? Click the button below to join the DZR Discord server.</Text>
          <Button
            as='a'
            href={'https://discord.gg/FBtCsddbmU'}
            target='_blank'
            rel='noopener noreferrer'
            leftIcon={<FaDiscord />}
            variant='outline'
            color='white'
            borderColor='whiteAlpha.400'
            _hover={{ bg: 'whiteAlpha.200' }}
            width='xs'
          >
            Join the DZR Discord server
          </Button>
        </Stack>
      </Grid>

      <Modal isOpen={isRoleModalOpen} onClose={() => setRoleModalOpen(false)} isCentered>
        <ModalOverlay bg='blackAlpha.600' backdropFilter='blur(2px)' />
        <ModalContent bg='black' color='white' border='1px solid' borderColor='whiteAlpha.300' rounded='md'>
          <ModalHeader color='white'>Access denied</ModalHeader>
          <ModalCloseButton color='white' _hover={{ bg: 'whiteAlpha.200' }} />
          <ModalBody pb={6} color='white'>
            <Stack spacing={4}>
              <Text>
                You need the Verified Member role on our Discord server to access the Members Zone. <br /> <br /> Not a member yet? Click the button below to join the DZR Discord server.
              </Text>
              <Button
                as='a'
                href={'https://discord.gg/FBtCsddbmU'}
                target='_blank'
                rel='noopener noreferrer'
                leftIcon={<FaDiscord />}
                background='rgba(88, 101, 242, 0.95)'
                color='white'
                _hover={{ background: 'rgba(88, 101, 242, 1)' }}
                alignSelf='flex-start'
              >
                Join the DZR Discord server
              </Button>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
}
