'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import FeaturesMembers from "@/components/FeaturesMembers";
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import { useRouter } from 'next/navigation';
 

import {
  Container,
  Heading,
  Text,
  Stack,
  Box,
  Divider,
   
} from '@chakra-ui/react';

const MembersZone = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [realName, setRealName] = useState<string | null>(null);

    useEffect(() => {
      if (status === 'unauthenticated') {
        const current = window.location.pathname + window.location.search;
        router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`);
        return;
      }
      async function fetchRealName() {
        try {
          if (!session?.user) return;
          const res = await fetch('/api/members/real-name');
          if (!res.ok) return;
          const data = await res.json();
          if (data?.displayName) setRealName(data.displayName);
        } catch {}
      }
      if (status === 'authenticated') fetchRealName();
    }, [session?.user, status, router]);

    if (status === 'loading') {
        return  <LoadingSpinnerMemb/>; // Show loading while checking auth
    }

    const greetingName = realName || (session?.user as any)?.name;

    return (
    <div >
        <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}}  display="flex" flexDirection="column">
        {session?.user ? (
            <>
                <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
                    <Heading color='white'>Members Zone</Heading>
                    <Text color={'white'}>Welcome, {greetingName}</Text>
                    <Divider mb={4}/>
                </Stack>
                <FeaturesMembers/>
            </>
        ) : (
            <Text align='center' color='white'>You need to login.</Text>
        )}
        </Container>
    </div>
    );
};

export default MembersZone;
