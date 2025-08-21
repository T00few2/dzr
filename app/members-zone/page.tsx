'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import FeaturesMembers from "@/components/FeaturesMembers";
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import EditProfileModal from '@/components/auth/EditProfileModal'; 

import {
  Container,
  Heading,
  Text,
  Stack,
  Button,
  Box,
  Divider,
  Center, // Import Button
} from '@chakra-ui/react';

const MembersZone = () => {
    const { data: session, status } = useSession();
    const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const [realName, setRealName] = useState<string | null>(null);

    useEffect(() => {
      async function fetchRealName() {
        try {
          if (!session?.user) return;
          const res = await fetch('/api/members/real-name');
          if (!res.ok) return;
          const data = await res.json();
          if (data?.displayName) setRealName(data.displayName);
        } catch {}
      }
      fetchRealName();
    }, [session?.user]);

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
                    <Center>
                        <Button background="rgba(173, 26, 45, 0.95)" color={'white'} onClick={() => signOut({ callbackUrl: '/login' })}  >
                            Log Out
                        </Button>
                        <Button background="rgba(0, 122, 255, 0.95)" color={'white'} onClick={() => setEditProfileModalOpen(true)} ml={4}>
                            Edit Profile
                        </Button>
                    </Center>
                    <Divider mb={4}/>
                </Stack>
                <FeaturesMembers/>

                {/* Edit Profile Modal */}
                <EditProfileModal 
                isOpen={isEditProfileModalOpen} 
                onClose={() => setEditProfileModalOpen(false)} 
                />
            </>
        ) : (
            <Text align='center' color='white'>You need to login.</Text>
        )}
        </Container>
    </div>
    );
};

export default MembersZone;
