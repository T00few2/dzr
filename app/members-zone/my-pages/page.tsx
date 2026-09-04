'use client';

import React, { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
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
import StravaConnectedModal from './StravaConnectedModal';

const Profile = dynamic(() => import('./profile/page'), { ssr: false });
const Membership = dynamic(() => import('./membership/page'), { ssr: false });
const Coach = dynamic(() => import('./coach/page'), { ssr: false });

const TAB_STYLE = {
  color: 'gray.300',
  _selected: { color: 'white', bg: 'gray.800', borderColor: 'gray.600', borderBottomColor: 'gray.800' },
} as const;

function parseTabIndex(raw: string | null, isClub: boolean) {
  if (raw === 'coach' || raw === '2') return isClub ? 2 : 0;
  if (raw === 'membership' || raw === '1') return 1;
  const n = raw ? parseInt(raw, 10) : 0;
  if (n === 2) return isClub ? 2 : 0;
  if (n === 1) return 1;
  return 0;
}

function MyPagesPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClub, setIsClub] = useState<boolean | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [stravaConnectedOpen, setStravaConnectedOpen] = useState(false);

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      const current = window.location.pathname + window.location.search;
      router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`);
    }
  }, [status, router]);

  React.useEffect(() => {
    let ignore = false;
    async function loadClub() {
      try {
        const res = await fetch('/api/membership/summary', { cache: 'no-store' });
        if (!res.ok) {
          if (!ignore) setIsClub(false);
          return;
        }
        const data = await res.json();
        if (!ignore) setIsClub(data?.currentStatus === 'club');
      } catch {
        if (!ignore) setIsClub(false);
      }
    }
    if (session) loadClub();
    return () => { ignore = true };
  }, [session]);

  React.useEffect(() => {
    if (isClub === null) return;
    setTabIndex(parseTabIndex(searchParams?.get('tab') ?? null, isClub));
  }, [isClub, searchParams]);

  React.useEffect(() => {
    if (searchParams?.get('strava') === 'connected') setStravaConnectedOpen(true);
  }, [searchParams]);

  const closeStravaConnected = () => {
    setStravaConnectedOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('strava');
    window.history.replaceState({}, '', url);
  };

  const handleTabChange = (index: number) => {
    setTabIndex(index);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', index.toString());
    window.history.pushState({}, '', url);
  };

  if (status === 'loading' || (session && isClub === null)) {
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
          <Tab {...TAB_STYLE}>
            Profile
          </Tab>
          <Tab {...TAB_STYLE}>
            Membership
          </Tab>
          {isClub && (
            <Tab {...TAB_STYLE}>
              Coach
            </Tab>
          )}
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <Profile />
          </TabPanel>
          <TabPanel px={0}>
            <Membership />
          </TabPanel>
          {isClub && (
            <TabPanel px={0}>
              <Coach />
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
      <StravaConnectedModal isOpen={stravaConnectedOpen} onClose={closeStravaConnected} />
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

