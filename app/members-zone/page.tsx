'use client';

import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth'; // Import signOut
import { auth } from '@/app/utils/firebaseConfig'; // Adjust path if necessary
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
    const { currentUser, loading } = useContext(AuthContext);
    const router = useRouter();
    const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !currentUser) {
            router.push('/login'); // Redirect to login if not authenticated
        }
    }, [currentUser, loading, router]);

    const handleLogout = async () => {
      try {
          await signOut(auth); // Sign out the user
          router.push('/login'); // Redirect to login after logout
      } catch (error: any) { // Use 'any' for general error type
          console.error("Logout failed:", error.message); // Safely access error.message
      }
  };

    if (loading) {
        return  <LoadingSpinnerMemb/>; // Show loading while checking auth
    }

    return (
    <div style={{backgroundColor:'black'}}>
        <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}}  display="flex" flexDirection="column">
        
            {currentUser ? (
            <>
                <Stack spacing={4} as={Container} maxW={'3xl'} textAlign={'center'}>
                    <Heading color='white'>Members Zone</Heading>
                    <Text color={'white'}>Welcome, {currentUser.displayName}</Text>
                    <Center>
                        <Button background="rgba(173, 26, 45, 0.95)" color={'white'} onClick={handleLogout}  >
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
