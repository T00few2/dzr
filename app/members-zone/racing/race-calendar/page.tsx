'use client';

import { useSession, signOut } from 'next-auth/react';
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
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <LoadingSpinnerMemb/>; // Show loading while checking auth
    }

    return (
        <div>
            {session?.user ? (
              <GoogleCalendarEmbed calendarId="138f1219bfbe08c3493a0457232fc30de6b6811c7bdcbf43c4ea14b84627135d%40group.calendar.google.com&ctz=Europe%2FCopenhagen"/>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}
        </div>
    );
};

export default RaceCalendar;