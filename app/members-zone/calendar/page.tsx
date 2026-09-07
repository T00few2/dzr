'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import { MAX_ENTRY_TEXT } from '@/app/lib/memberCalendar';

type Entry = {
  id: string;
  eventDate: string;
  text: string;
  kind: 'session' | 'race' | 'event' | 'other';
  startTime: string | null;
  source: 'member' | 'coach';
  status: 'planned' | 'done' | 'skipped';
};

type Goal = { id: string; text: string; eventDate: string };

const KIND_LABELS: Record<Entry['kind'], string> = {
  session: 'Træning',
  race: 'Løb',
  event: 'Event',
  other: 'Andet',
};

const KIND_COLORS: Record<Entry['kind'], string> = {
  session: 'blue',
  race: 'red',
  event: 'purple',
  other: 'gray',
};

/** Copenhagen's date, so "i dag" matches the club's day rather than the browser's timezone. */
function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Copenhagen',
  }).format(new Date());
}

function formatDay(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [kind, setKind] = useState<Entry['kind']>('session');

  useEffect(() => {
    if (status === 'unauthenticated') {
      const current = window.location.pathname + window.location.search;
      router.replace(`/login?callbackUrl=${encodeURIComponent(current)}`);
    }
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setGoals(Array.isArray(data.goals) ? data.goals : []);
    } catch {
      toast({ title: 'Kunne ikke hente kalenderen', status: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function addEntry() {
    setSaving(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), eventDate: date, startTime: time || null, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme');
      setEntries(data.entries || []);
      setText('');
      setTime('');
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme', status: 'error', duration: 4000 });
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    try {
      const res = await fetch(`/api/calendar?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke slette');
      setEntries(data.entries || []);
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke slette', status: 'error', duration: 4000 });
    }
  }

  async function setStatus(id: string, next: Entry['status']) {
    try {
      const res = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke opdatere');
      setEntries(data.entries || []);
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke opdatere', status: 'error', duration: 4000 });
    }
  }

  // The API returns newest first so the read is cheap; the agenda wants the opposite, and past
  // entries stay visible below rather than being hidden — they are the record of what was planned.
  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const sorted = [...entries].sort((a, b) => {
      const byDate = a.eventDate.localeCompare(b.eventDate);
      if (byDate !== 0) return byDate;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });
    return {
      upcoming: sorted.filter((e) => e.eventDate >= today),
      past: sorted.filter((e) => e.eventDate < today).reverse(),
    };
  }, [entries]);

  if (status === 'loading' || (session && loading)) return <LoadingSpinnerMemb />;
  if (!session) return null;

  const canAdd = text.trim().length > 0 && date.length > 0 && !saving;

  const renderEntry = (entry: Entry, dimmed = false) => (
    <Flex
      key={entry.id}
      align="center"
      justify="space-between"
      gap={3}
      py={2}
      opacity={dimmed || entry.status !== 'planned' ? 0.6 : 1}
    >
      <Box minW={0}>
        <HStack spacing={2} mb={1} flexWrap="wrap">
          <Badge colorScheme={KIND_COLORS[entry.kind]}>{KIND_LABELS[entry.kind]}</Badge>
          {entry.startTime && (
            <Text color="gray.300" fontSize="sm" fontWeight="bold">{entry.startTime}</Text>
          )}
          {entry.source === 'coach' && (
            <Badge variant="outline" colorScheme="teal">tilføjet af coachen</Badge>
          )}
          {entry.status !== 'planned' && (
            <Badge variant="subtle" colorScheme={entry.status === 'done' ? 'green' : 'orange'}>
              {entry.status === 'done' ? 'gennemført' : 'sprunget over'}
            </Badge>
          )}
        </HStack>
        <Text color="white" noOfLines={2}>{entry.text}</Text>
        <Text color="gray.500" fontSize="xs">{formatDay(entry.eventDate)}</Text>
      </Box>
      <HStack spacing={1} flexShrink={0}>
        <Button
          size="xs"
          variant="ghost"
          color="gray.300"
          onClick={() => setStatus(entry.id, entry.status === 'done' ? 'planned' : 'done')}
        >
          {entry.status === 'done' ? 'Fortryd' : 'Gennemført'}
        </Button>
        <IconButton
          aria-label="Slet"
          icon={<DeleteIcon />}
          size="xs"
          variant="ghost"
          color="gray.400"
          onClick={() => removeEntry(entry.id)}
        />
      </HStack>
    </Flex>
  );

  return (
    <Container maxW="4xl" py={8}>
      <Heading color="white" size="xl" mb={2}>Kalender</Heading>
      <Text color="gray.400" mb={6}>
        Din egen plan: træning, løb og events. Kun du kan se den. Har du DZR Coach slået til,
        kan coachen også se den og tage højde for den.
      </Text>

      {goals.length > 0 && (
        <Box mb={8}>
          <Heading color="white" size="sm" mb={2}>Mål</Heading>
          <Stack spacing={1} mb={2}>
            {goals.map((goal) => (
              <Text key={goal.id} color="gray.200" fontSize="sm">
                {formatDay(goal.eventDate)} — {goal.text}
              </Text>
            ))}
          </Stack>
          {/* Read-only on purpose: goals live in coach memory, capped at three and confirmed with
              a Ja. Editing them here would mean two places writing the same row. */}
          <Text color="gray.500" fontSize="xs">
            Mål redigeres under{' '}
            <Box as="a" href="/members-zone/my-pages?tab=2" textDecoration="underline">
              My Pages → Coach
            </Box>.
          </Text>
        </Box>
      )}

      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" rounded="md" p={4} mb={8}>
        <Heading color="white" size="sm" mb={3}>Tilføj til kalenderen</Heading>
        <Stack spacing={2}>
          <Input
            placeholder="Fx DZR After Party (C), eller 2 timer roligt"
            value={text}
            maxLength={MAX_ENTRY_TEXT}
            onChange={(e) => setText(e.target.value)}
            bg="gray.800"
            borderColor="gray.600"
            size="sm"
          />
          <HStack flexWrap="wrap">
            <Input
              type="date"
              value={date}
              min={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              bg="gray.800"
              borderColor="gray.600"
              size="sm"
              maxW="180px"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              bg="gray.800"
              borderColor="gray.600"
              size="sm"
              maxW="130px"
            />
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as Entry['kind'])}
              bg="gray.800"
              borderColor="gray.600"
              size="sm"
              maxW="150px"
            >
              <option value="session">Træning</option>
              <option value="race">Løb</option>
              <option value="event">Event</option>
              <option value="other">Andet</option>
            </Select>
            <Button size="sm" colorScheme="red" onClick={addEntry} isLoading={saving} isDisabled={!canAdd}>
              Tilføj
            </Button>
          </HStack>
        </Stack>
      </Box>

      <Heading color="white" size="sm" mb={2}>Kommende</Heading>
      {upcoming.length === 0 ? (
        <Text color="gray.500" fontSize="sm" mb={8}>Ingenting planlagt endnu.</Text>
      ) : (
        <Stack divider={<Divider borderColor="gray.700" />} mb={8}>
          {upcoming.map((entry) => renderEntry(entry))}
        </Stack>
      )}

      {past.length > 0 && (
        <>
          <Heading color="white" size="sm" mb={2}>Tidligere</Heading>
          <Stack divider={<Divider borderColor="gray.700" />}>
            {past.slice(0, 20).map((entry) => renderEntry(entry, true))}
          </Stack>
        </>
      )}
    </Container>
  );
}
