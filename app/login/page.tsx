// app/login/page.tsx

'use client'; // This line is essential for client components

import React, { useState, useEffect, Suspense } from 'react';
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

import { VERIFIED_MEMBER_ROLE_ID } from '@/app/lib/sharedConstants';

const REQUIRED_ROLE_ID = VERIFIED_MEMBER_ROLE_ID;

function LoginContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams?.get('error');
  const callbackUrl = searchParams?.get('callbackUrl') || '/members-zone';
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);

  const handleSignInDiscord = async () => {
    await signIn('discord', { callbackUrl });
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
            Log ind med den Discord-konto, der er brugt til kontingent. Betalende klubmedlemmer kommer ind, også selvom Discord-rollen ikke er opdateret endnu.
          </Text>
          <Button onClick={handleSignInDiscord} leftIcon={<FaDiscord />} background="rgba(88, 101, 242, 0.95)" color={'white'} width='xs'>
            Sign in with Discord
          </Button>
          {urlError ? (
            <Text color="orange.200" width="xs" textAlign="left">
              {showMissingRole
                ? 'Discord godkendte dig, men den konto er ikke registreret som betalende medlem i år. Brug samme Discord-konto som på /join.'
                : 'Discord-login blev afbrudt, før du kom ind. Prøv igen.'}
            </Text>
          ) : null}
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
          <ModalHeader color='white'>Ikke lukket ind</ModalHeader>
          <ModalCloseButton color='white' _hover={{ bg: 'whiteAlpha.200' }} />
          <ModalBody pb={6} color='white'>
            <Stack spacing={4}>
              <Text>
                Discord-kontoen blev godkendt, men den er ikke koblet til et betalt klubmedlemskab for i år. Log ind med den samme konto, som /join bruger til at vise dit medlemskab.
              </Text>
              <Button
                as='a'
                href='/join'
                background='rgba(173, 26, 45, 0.95)'
                color='white'
                _hover={{ background: 'rgba(173, 26, 45, 1)' }}
                alignSelf='flex-start'
              >
                Se medlemskab på /join
              </Button>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
