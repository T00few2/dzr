'use client';

import React, { useState } from 'react';
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

const ClubStats = dynamic(() => import('./club-stats/page'), { ssr: false });

export default function StatsHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
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
        Stats
      </Heading>
      
      <Tabs index={tabIndex} onChange={handleTabChange} colorScheme="red" variant="enclosed">
        <TabList borderColor="gray.600">
          <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
            Club Stats
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <ClubStats />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
}

