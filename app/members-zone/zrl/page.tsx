// app/members-zone/ZRL/page.tsx
'use client';

import { useContext, useEffect } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import ZRL from "@/components/ZRL/ZRL";
import {Text} from '@chakra-ui/react';

const ZRLpage = () => {
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
                <ZRL/>
              </div>
            ) : (
                <Text align='center' color='white'>You need to login.</Text>
            )}

            </div>
    );
};

export default ZRLpage;