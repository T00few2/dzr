'use client';

import React, { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import dynamic from 'next/dynamic';

const Profile = dynamic(() => import('./profile/page'), { ssr: false });
const Membership = dynamic(() => import('./membership/page'), { ssr: false });

function MyPagesPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const isAdmin: boolean = Boolean((session?.user as any)?.isAdmin);
  
  const tabFromUrl = searchParams?.get('tab');
  const initialTab = tabFromUrl ? parseInt(tabFromUrl) : 0;
  const [tabIndex, setTabIndex] = useState(initialTab);

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      const current = window.location.pathname + window.location.search;
      router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`);
    }
  }, [status, router]);

  const handleTabChange = (index: number) => {
    setTabIndex(index);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', index.toString());
    window.history.pushState({}, '', url);
  };

  if (status === 'loading') {
    return <LoadingSpinnerMemb />;
  }

  if (!session) {
    return null;
  }

  return (
    <Container maxW="7xl" py={8}>
      <Heading color="white" size="xl" mb={6}>
        My Pages
      </Heading>
      
      <Tabs index={tabIndex} onChange={handleTabChange} colorScheme="red" variant="enclosed">
        <TabList borderColor="gray.600">
          <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
            Profile
          </Tab>
          {isAdmin && (
            <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
              Membership
            </Tab>
          )}
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <Profile />
          </TabPanel>
          {isAdmin && (
            <TabPanel px={0}>
              <Membership />
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Container>
  );
}

export default function MyPagesPage() {
  return (
    <Suspense fallback={<LoadingSpinnerMemb />}>
      <MyPagesPageContent />
    </Suspense>
  );
}

