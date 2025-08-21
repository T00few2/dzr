// pages/coming-soon.tsx
'use client';

import ComingSoon from "@/components/ComingSoon";
import { useSession } from 'next-auth/react';
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
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <LoadingSpinnerMemb/> // Show loading while checking auth
    }

    return (
        <div>
            {session?.user ? (
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