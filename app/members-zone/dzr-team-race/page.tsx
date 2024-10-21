// pages/coming-soon.tsx
'use client';

import ComingSoon from "@/components/ComingSoon";
import { useContext, useEffect } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth'; // Import signOut
import { auth } from '@/app/utils/firebaseConfig'; // Adjust path if necessary
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';

import {
  Container,
  Heading,
  Text,
  Stack,
  Button,
  Center, // Import Button
} from '@chakra-ui/react';

const DZRTeamRace = () => {
    const { currentUser, loading } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
        if (!loading && !currentUser) {
            router.push('/login'); // Redirect to login if not authenticated
        }
    }, [currentUser, loading, router]);

    if (loading) {
        return <LoadingSpinnerMemb/> // Show loading while checking auth
    }

    return (
        <div>
            {currentUser ? (
              <div>
                <ComingSoon/>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default DZRTeamRace;