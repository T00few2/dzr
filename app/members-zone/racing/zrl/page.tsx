// app/members-zone/ZRL/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import ZRL from "@/components/ZRL/ZRL";
import {Text} from '@chakra-ui/react';

const ZRLpage = () => {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <LoadingSpinnerMemb/> // Show loading while checking auth
    }

    return (
        <div>
            {session?.user ? (
              <div>
                <ZRL/>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default ZRLpage;