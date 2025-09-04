"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Container, Heading, Box, Text, Button, Table, Thead, Tr, Th, Tbody, Td, Spinner, useToast, Flex } from '@chakra-ui/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';

type RiderRow = {
  riderId: number;
  name: string;
  country?: string;
  zpCategory?: string;
  racingScore?: number | null;
  veloRating?: number | null;
  max30Rating?: number | null;
  max90Rating?: number | null;
  zpFTP?: number | null;
  phenotype?: string | null;
  weight?: number | null;
  w5?: number | null; w15?: number | null; w30?: number | null; w60?: number | null; w120?: number | null; w300?: number | null; w1200?: number | null;
  wkg5?: number | null; wkg15?: number | null; wkg30?: number | null; wkg60?: number | null; wkg120?: number | null; wkg300?: number | null; wkg1200?: number | null;
  cp?: number | null;
  compoundScore?: number | null;
};

export default function KMSpage() {
  const { data: session, status } = useSession();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [currentUserSignedUp, setCurrentUserSignedUp] = useState(false);
  const [discordProfiles, setDiscordProfiles] = useState<Record<string, { displayName: string; avatarUrl?: string }>>({});
  const [sort, setSort] = useState<{ key: keyof RiderRow; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/kms/signups', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setRows(data?.items || []);
      setCurrentUserSignedUp(Boolean(data?.currentUserSignedUp));
    } catch (err: any) {
      toast({ title: 'Failed to load signups', description: err?.message, status: 'error', position: 'top-right' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await fetch('/api/stats/captain-roles', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const profilesArr: { zwiftId: string; displayName?: string; avatarUrl?: string }[] = data?.profiles || [];
        const map: Record<string, { displayName: string; avatarUrl?: string }> = {};
        profilesArr.forEach((p) => {
          if (p.zwiftId) map[String(p.zwiftId)] = { displayName: p.displayName || '', avatarUrl: p.avatarUrl };
        });
        setDiscordProfiles(map);
      } catch {}
    };
    loadProfiles();
  }, []);

  const toggleSort = (key: keyof RiderRow) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    const factor = dir === 'asc' ? 1 : -1;
    arr.sort((a: any, b: any) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb)) * factor;
      }
      const na = Number(va);
      const nb = Number(vb);
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return (na - nb) * factor;
    });
    return arr;
  }, [rows, sort]);

  const onSignup = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/kms/signups', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Signup failed');
      await load();
    } catch (err: any) {
      toast({ title: 'Signup failed', description: err?.message, status: 'error', position: 'top-right' });
    } finally {
      setLoading(false);
    }
  };

  const onWithdraw = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/kms/signups', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Withdraw failed');
      await load();
    } catch (err: any) {
      toast({ title: 'Withdraw failed', description: err?.message, status: 'error', position: 'top-right' });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return <LoadingSpinnerMemb />;

  return (
    <Container maxW={{ base: '95%', md: '6xl' }} py={4} color='white'>
      <Heading size='lg' mb={2}>Klubmesterskab</Heading>
      <Heading size='md' mb={2}>19:30 tirsdag den 28. oktober</Heading>
      <Text mb={6}>Mere information kommer snart..</Text>
      {!session?.user ? (
        <Text align='center'>You need to login.</Text>
      ) : (
        <>
          <Box mb={4}>
            {currentUserSignedUp ? (
              <Flex align='center' gap={3}>
                <Text>Afmeld dig her:</Text>
                <Button size='sm' background="rgba(173, 26, 45, 0.95)" color={'white'} _hover={{ background: 'rgba(173, 26, 45, 1)' }} onClick={onWithdraw} isLoading={loading}>Afmeld</Button>
              </Flex>
            ) : (
              <Flex align='center' gap={3}>
                <Text>Tilmeld dig her:</Text>
                <Button size='sm' background="rgba(0, 122, 255, 0.95)" color={'white'} _hover={{ background: 'rgba(0, 122, 255, 1)' }} onClick={onSignup} isLoading={loading}>Tilmeld</Button>
              </Flex>
            )}
          </Box>

          <Heading size='md' mb={2}>Signed up riders</Heading>
          {loading ? (
            <Spinner color='teal.400' />
          ) : rows.length === 0 ? (
            <Text>No signups yet.</Text>
          ) : (
            <Box border='1px solid' borderColor='whiteAlpha.300' rounded='md' overflowX='auto' maxH='480px' overflowY='auto'>
              <Table size='sm' variant='simple' sx={{ 'th, td': { py: 1, fontSize: 'sm' }, 'thead th': { position: 'sticky', top: 0, zIndex: 1, background: 'black' } }}>
                <Thead>
                  <Tr>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('name')}>Name {sort.key==='name' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('phenotype')}>Phenotype {sort.key==='phenotype' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('zpCategory')}>ZPG {sort.key==='zpCategory' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('racingScore')}>ZRS {sort.key==='racingScore' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('veloRating')}>vELO {sort.key==='veloRating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('max30Rating')}>vELO 30 {sort.key==='max30Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('max90Rating')}>vELO 90 {sort.key==='max90Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('zpFTP')}>zFTP {sort.key==='zpFTP' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('cp')}>CP {sort.key==='cp' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('compoundScore')}>CS {sort.key==='compoundScore' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w5')}>w5 {sort.key==='w5' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w15')}>w15 {sort.key==='w15' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w30')}>w30 {sort.key==='w30' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w60')}>w60 {sort.key==='w60' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w120')}>w120 {sort.key==='w120' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w300')}>w300 {sort.key==='w300' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('w1200')}>w1200 {sort.key==='w1200' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg5')}>WKG5 {sort.key==='wkg5' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg15')}>WKG15 {sort.key==='wkg15' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg30')}>WKG30 {sort.key==='wkg30' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg60')}>WKG60 {sort.key==='wkg60' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg120')}>WKG120 {sort.key==='wkg120' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg300')}>WKG300 {sort.key==='wkg300' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg1200')}>WKG1200 {sort.key==='wkg1200' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                    <Th color='white' cursor='pointer' onClick={() => toggleSort('weight')}>Weight {sort.key==='weight' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {sortedRows.map(r => (
                    <Tr key={r.riderId}>
                      <Td color='white'>
                        <Flex align='center' gap={2}>
                          <Box as='img' src={discordProfiles[String(r.riderId)]?.avatarUrl} alt='' width='20px' height='20px' borderRadius='full' display={discordProfiles[String(r.riderId)]?.avatarUrl ? 'block' : 'none'} />
                          <span>{discordProfiles[String(r.riderId)]?.displayName || r.name}</span>
                        </Flex>
                      </Td>
                      <Td color='white'>{r.phenotype ?? '—'}</Td>
                      <Td color='white'>{r.zpCategory ?? '—'}</Td>
                      <Td color='white'>{r.racingScore != null ? Math.round(r.racingScore) : '—'}</Td>
                      <Td color='white'>{r.veloRating != null ? Math.round(r.veloRating) : '—'}</Td>
                      <Td color='white'>{r.max30Rating != null ? Math.round(r.max30Rating) : '—'}</Td>
                      <Td color='white'>{r.max90Rating != null ? Math.round(r.max90Rating) : '—'}</Td>
                      <Td color='white'>{r.zpFTP != null ? Math.round(r.zpFTP) : '—'}</Td>
                      <Td color='white'>{r.cp != null ? Math.round(r.cp) : '—'}</Td>
                      <Td color='white'>{r.compoundScore != null ? Math.round(r.compoundScore) : '—'}</Td>
                      <Td color='white'>{r.w5 ?? '—'}</Td>
                      <Td color='white'>{r.w15 ?? '—'}</Td>
                      <Td color='white'>{r.w30 ?? '—'}</Td>
                      <Td color='white'>{r.w60 ?? '—'}</Td>
                      <Td color='white'>{r.w120 ?? '—'}</Td>
                      <Td color='white'>{r.w300 ?? '—'}</Td>
                      <Td color='white'>{r.w1200 ?? '—'}</Td>
                      <Td color='white'>{r.wkg5 != null ? r.wkg5.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg15 != null ? r.wkg15.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg30 != null ? r.wkg30.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg60 != null ? r.wkg60.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg120 != null ? r.wkg120.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg300 != null ? r.wkg300.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.wkg1200 != null ? r.wkg1200.toFixed(2) : '—'}</Td>
                      <Td color='white'>{r.weight ?? '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}


