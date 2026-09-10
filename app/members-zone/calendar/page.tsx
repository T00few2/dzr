'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Collapse,
  Container,
  Divider,
  HStack,
  Heading,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import type { ZwiftEventSummary, ZwiftEventSubgroup } from '@/packages/shared/zwiftEvents';
import { CalendarRow } from './CalendarRow';
import DayModal from './DayModal';
import MonthGrid from './MonthGrid';
import {
  sortAgendaRows,
  todayIso,
  type Entry,
  type Goal,
} from './calendarShared';

/**
 * The coach notes endpoint returns every note kind; keep the goals, live and expired alike, and
 * mark which is which. Expired ones fall under Tidligere, where they can be deleted.
 */
function goalsFrom(notes: unknown): Goal[] {
  const today = todayIso();
  return (Array.isArray(notes) ? notes : [])
    .filter((n: any) => n?.kind === 'goal' && typeof n?.eventDate === 'string' && n?.text)
    .map((n: any) => ({
      id: String(n.id),
      text: String(n.text),
      eventDate: n.eventDate,
      expired: n.eventDate < today,
    }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isClubMember, setIsClubMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  const [events, setEvents] = useState<ZwiftEventSummary[]>([]);
  const [racingScore, setRacingScore] = useState<number | null>(null);
  const [eventsUnavailable, setEventsUnavailable] = useState(false);
  const [addingEventId, setAddingEventId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      setIsClubMember(data.isClubMember === true);
    } catch {
      toast({ title: 'Kunne ikke hente kalenderen', status: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Suggestions are secondary: a failure here must leave the calendar itself working, so it has
  // its own request and its own failure state rather than sharing the calendar's.
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/events', { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setRacingScore(typeof data.racingScore === 'number' ? data.racingScore : null);
      setEventsUnavailable(data.unavailable === true);
    } catch {
      setEvents([]);
      setEventsUnavailable(true);
    }
  }, []);

  useEffect(() => {
    if (session) {
      load();
      loadEvents();
    }
  }, [session, load, loadEvents]);

  async function addEntry(payload: {
    text: string;
    eventDate: string;
    startTime: string | null;
    kind: Entry['kind'];
  }) {
    setSaving(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme');
      setEntries(data.entries || []);
      return true;
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme', status: 'error', duration: 4000 });
      return false;
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

  /**
   * Add one category of a DZR event.
   *
   * Stores the subgroup's own start time, never the parent event's: the categories go off up to
   * five minutes apart, and the wrong minute is how someone misses their race.
   */
  async function addFromEvent(event: ZwiftEventSummary, subgroup: ZwiftEventSubgroup, asGoal: boolean) {
    setAddingEventId(event.id);
    try {
      const text = `${event.name} (${subgroup.label})`;
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          eventDate: subgroup.eventDate,
          startTime: subgroup.startTime,
          kind: event.eventType === 'RACE' ? 'race' : 'event',
          sourceEventId: `${event.id}:${subgroup.id}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme');
      setEntries(data.entries || []);
      if (asGoal) {
        await addGoal(text, subgroup.eventDate, { quiet: true });
      }
      toast({ title: `Lagt i kalenderen: ${event.name} (${subgroup.label})`, status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme', status: 'error', duration: 4000 });
    } finally {
      setAddingEventId(null);
    }
  }

  async function addGoal(text: string, eventDate: string, opts?: { quiet?: boolean }) {
    setSavingGoal(true);
    try {
      // Goals still live in coach memory, so they go through the coach notes endpoint rather than
      // the calendar one — the page shows them together, the stores stay separate.
      const res = await fetch('/api/coach/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), kind: 'goal', eventDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme målet');
      setGoals(goalsFrom(data?.notes));
      if (!opts?.quiet) toast({ title: 'Mål gemt', status: 'success', duration: 3000 });
      return true;
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme målet', status: 'error', duration: 4000 });
      return false;
    } finally {
      setSavingGoal(false);
    }
  }

  async function removeGoal(id: string) {
    try {
      const res = await fetch(`/api/coach/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke slette målet');
      setGoals(goalsFrom(data?.notes));
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke slette målet', status: 'error', duration: 4000 });
    }
  }

  async function clearAll() {
    if (!window.confirm('Slette hele din kalender? Det kan ikke fortrydes.')) return;
    try {
      const res = await fetch('/api/calendar?all=1', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke slette');
      setEntries([]);
      toast({ title: 'Kalenderen er tømt', status: 'success', duration: 3000 });
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

  const past = useMemo(() => {
    const today = todayIso();
    return sortAgendaRows(entries, goals)
      .filter((r) => r.eventDate < today)
      .reverse();
  }, [entries, goals]);

  if (status === 'loading' || (session && loading)) return <LoadingSpinnerMemb />;
  if (!session) return null;

  const pastShown = past.slice(0, 20);

  return (
    <Container maxW="7xl" py={8}>
      <Heading color="white" size="xl" mb={2}>Kalender</Heading>
      <Text color="gray.400" mb={6}>
        Din egen plan: træning, løb og events. Kun du kan se den. Har du DZR Coach slået til,
        kan coachen også se den og tage højde for den. Klik på en dag for at tilføje.
      </Text>

      <MonthGrid
        entries={entries}
        goals={goals}
        events={events}
        selectedIso={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <HStack spacing={4} mt={3} mb={eventsUnavailable ? 2 : 8} flexWrap="wrap" color="gray.500" fontSize="xs">
        <HStack spacing={1}>
          <Box w="14px" h="10px" rounded="sm" bg="blue.500" />
          <Text>Din plan</Text>
        </HStack>
        <HStack spacing={1}>
          <Box w="14px" h="10px" rounded="sm" borderWidth="1px" borderStyle="dashed" borderColor="red.400" />
          <Text>DZR du kan tilføje</Text>
        </HStack>
        <HStack spacing={1}>
          <Text>⭐</Text>
          <Text>Mål</Text>
        </HStack>
      </HStack>
      {eventsUnavailable && (
        <Text color="gray.500" fontSize="sm" mb={8}>
          Kunne ikke hente DZR-løb fra Zwift lige nu. Du kan stadig tilføje dem ved at klikke på en dag.
        </Text>
      )}

      {pastShown.length > 0 && (
        <Box mb={8}>
          <Button
            variant="ghost"
            color="gray.300"
            size="sm"
            px={0}
            rightIcon={pastOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            onClick={() => setPastOpen((open) => !open)}
            aria-expanded={pastOpen}
          >
            Tidligere ({pastShown.length})
          </Button>
          <Collapse in={pastOpen} animateOpacity>
            <Stack divider={<Divider borderColor="gray.700" />} mt={2}>
              {pastShown.map((row) => (
                <CalendarRow
                  key={row.rowKind === 'goal' ? `goal:${row.goal.id}` : row.entry.id}
                  row={row}
                  dimmed
                  onStatus={setStatus}
                  onRemoveEntry={removeEntry}
                  onRemoveGoal={removeGoal}
                />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      {entries.length > 0 && (
        <>
          <Divider borderColor="gray.700" mb={4} />
          {/* Kalenderen bliver ikke slettet sammen med coach-data, så den skal have sin egen. */}
          <Button size="xs" variant="ghost" color="gray.500" onClick={clearAll}>
            Slet hele kalenderen
          </Button>
        </>
      )}

      <DayModal
        date={selectedDate}
        entries={entries}
        goals={goals}
        events={events}
        racingScore={racingScore}
        isClubMember={isClubMember}
        saving={saving}
        savingGoal={savingGoal}
        addingEventId={addingEventId}
        onClose={() => setSelectedDate(null)}
        onAddEntry={addEntry}
        onAddFromEvent={addFromEvent}
        onAddGoal={addGoal}
        onStatus={setStatus}
        onRemoveEntry={removeEntry}
        onRemoveGoal={removeGoal}
      />
    </Container>
  );
}
