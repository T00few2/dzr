'use client';

import { useContext, useEffect } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth'; // Import signOut
import { auth } from '@/app/utils/firebaseConfig'; // Adjust path if necessary
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';

import GoogleCalendarEmbed from "@/components/GoogleCalendar";
import {
  Container,
  Heading,
  Text,
  Stack,
  Button,
  Center, // Import Button
} from '@chakra-ui/react';

const RaceCalendar = () => {
    const { currentUser, loading } = useContext(AuthContext);
    const router = useRouter();

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
        return <LoadingSpinnerMemb/>; // Show loading while checking auth
    }

    return (
        <div>
            {currentUser ? (
              <div>
                <GoogleCalendarEmbed calendarId="138f1219bfbe08c3493a0457232fc30de6b6811c7bdcbf43c4ea14b84627135d%40group.calendar.google.com&ctz=Europe%2FCopenhagen"/>
                <Center>
                <Button background="rgba(173, 26, 45, 0.95)" color={'white'} onClick={handleLogout} mt={4} mb={4}>
                    Log Out
                </Button>
                </Center>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default RaceCalendar;