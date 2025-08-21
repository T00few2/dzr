// app/members-zone/KMS/page.tsx
'use client';


import { useSession, signOut } from 'next-auth/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import KMS from '@/components/KMS/KMS';

import {
  Text,
} from '@chakra-ui/react';

const KMSpage = () => {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return <LoadingSpinnerMemb/> // Show loading while checking auth
    }

    return (
        <div>
            {session?.user ? (
              <div>
                <KMS/>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default KMSpage;