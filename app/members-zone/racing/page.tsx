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

// Import child page components
import dynamic from 'next/dynamic';

const RaceCalendar = dynamic(() => import('./race-calendar/page'), { ssr: false });
const ZRL = dynamic(() => import('./zrl/page'), { ssr: false });
const TeamManagement = dynamic(() => import('./team-management/page'), { ssr: false });

function RacingPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const roles: string[] = Array.isArray((session?.user as any)?.roles) ? (session?.user as any).roles : [];
  const isAdmin: boolean = Boolean((session?.user as any)?.isAdmin);
  const isCaptain: boolean = roles.includes('1195878349617250405');
  
  // Get tab from URL or default to 0
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
    // Update URL with tab parameter
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
        Racing
      </Heading>
      
      <Tabs index={tabIndex} onChange={handleTabChange} colorScheme="red" variant="enclosed">
        <TabList borderColor="gray.600">
          <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
            DZR Racing Teams
          </Tab>
          {(isAdmin || isCaptain) && (
            <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
              Team Management
            </Tab>
          )}
          <Tab color="gray.300" _selected={{ color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' }}>
            Race Calendar
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <ZRL />
          </TabPanel>
          {(isAdmin || isCaptain) && (
            <TabPanel px={0}>
              <TeamManagement />
            </TabPanel>
          )}
          <TabPanel px={0}>
            <RaceCalendar />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
}

export default function RacingPage() {
  return (
    <Suspense fallback={<LoadingSpinnerMemb />}>
      <RacingPageContent />
    </Suspense>
  );
}

