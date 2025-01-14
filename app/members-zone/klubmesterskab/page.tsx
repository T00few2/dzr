// app/members-zone/KMS/page.tsx
'use client';


import { useContext, useEffect } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import KMS from '@/components/KMS/KMS';

import {
  Text,
} from '@chakra-ui/react';

const KMSpage = () => {
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
                <KMS/>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default KMSpage;