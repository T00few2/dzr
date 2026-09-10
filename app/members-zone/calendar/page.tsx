'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Divider,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import { MAX_ENTRY_TEXT } from '@/app/lib/memberCalendar';
import type { ZwiftEventSummary, ZwiftEventSubgroup } from '@/packages/shared/zwiftEvents';
import { CalendarRow } from './CalendarRow';
import DayModal from './DayModal';
import MonthGrid from './MonthGrid';
import {
  MAX_ACTIVE_GOALS,
  sortAgendaRows,
  todayIso,
  type Entry,
  type Goal,
} from './calendarShared';

/**
 * The coach notes endpoint returns every note kind; keep the goals, live and expired alike, and
 * mark which is which. The page shows live ones in the agenda and expired ones under Tidligere,
 * where they can be deleted.
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
  const [goalText, setGoalText] = useState('');
  const [goalDate, setGoalDate] = useState('');

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
  async function addFromEvent(event: ZwiftEventSummary, subgroup: ZwiftEventSubgroup) {
    setAddingEventId(event.id);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${event.name} (${subgroup.label})`,
          eventDate: subgroup.eventDate,
          startTime: subgroup.startTime,
          kind: event.eventType === 'RACE' ? 'race' : 'event',
          sourceEventId: `${event.id}:${subgroup.id}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme');
      setEntries(data.entries || []);
      toast({ title: `Lagt i kalenderen: ${event.name} (${subgroup.label})`, status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme', status: 'error', duration: 4000 });
    } finally {
      setAddingEventId(null);
    }
  }

  async function addGoal() {
    setSavingGoal(true);
    try {
      // Goals still live in coach memory, so they go through the coach notes endpoint rather than
      // the calendar one — the page shows them together, the stores stay separate.
      const res = await fetch('/api/coach/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: goalText.trim(), kind: 'goal', eventDate: goalDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Kunne ikke gemme målet');
      setGoals(goalsFrom(data?.notes));
      setGoalText('');
      setGoalDate('');
      toast({ title: 'Mål gemt', status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: err?.message || 'Kunne ikke gemme målet', status: 'error', duration: 4000 });
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

  // The API returns newest first so the read is cheap; the agenda wants the opposite, and past
  // entries stay visible below rather than being hidden — they are the record of what was planned.
  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const rows = sortAgendaRows(entries, goals);
    return {
      upcoming: rows.filter((r) => r.eventDate >= today),
      past: rows.filter((r) => r.eventDate < today).reverse(),
    };
  }, [entries, goals]);

  if (status === 'loading' || (session && loading)) return <LoadingSpinnerMemb />;
  if (!session) return null;

  return (
    <Container maxW="7xl" py={8}>
      <Heading color="white" size="xl" mb={2}>Kalender</Heading>
      <Text color="gray.400" mb={6}>
        Din egen plan: træning, løb og events. Kun du kan se den. Har du DZR Coach slået til,
        kan coachen også se den og tage højde for den. Klik på en dag for at tilføje.
      </Text>

      {/* Goals are club-only because they are coach memory and the coach comes with membership.
          The rest of the calendar is open to every verified member, so this is one section that
          explains itself rather than a gate on the page. */}
      <Box bg="gray.900" borderWidth="1px" borderColor="gray.700" rounded="md" p={4} mb={4}>
        <HStack mb={3} spacing={2}>
          <Text fontSize="sm" role="img" aria-label="Mål">⭐</Text>
          <Heading color="white" size="sm">Sæt et mål</Heading>
        </HStack>
        {!isClubMember ? (
          <Text color="gray.400" fontSize="sm">
            Mål følger med DZR Coach, som er en del af klubmedlemskabet. Du kan stadig planlægge
            træning og løb i kalenderen nedenfor.
          </Text>
        ) : goals.filter((g) => !g.expired).length >= MAX_ACTIVE_GOALS ? (
          <Text color="gray.400" fontSize="sm">
            Du har {MAX_ACTIVE_GOALS} aktive mål. Slet et nedenfor, før du tilføjer et nyt.
          </Text>
        ) : (
          <>
            <Text color="gray.500" fontSize="xs" mb={2}>
              Et mål er en dato du træner frem mod. Coachen styrer træningen efter det —
              højst {MAX_ACTIVE_GOALS} ad gangen.
            </Text>
            <Stack spacing={2}>
              <Input
                placeholder="Fx tabe 3 kg, eller ZRL-finalen"
                value={goalText}
                maxLength={MAX_ENTRY_TEXT}
                onChange={(e) => setGoalText(e.target.value)}
                bg="gray.800"
                borderColor="gray.600"
                size="sm"
              />
              <HStack>
                <Input
                  type="date"
                  value={goalDate}
                  min={todayIso()}
                  onChange={(e) => setGoalDate(e.target.value)}
                  bg="gray.800"
                  borderColor="gray.600"
                  size="sm"
                  maxW="180px"
                />
                <Button
                  size="sm"
                  colorScheme="yellow"
                  onClick={addGoal}
                  isLoading={savingGoal}
                  isDisabled={!goalText.trim() || !goalDate || savingGoal}
                >
                  Gem mål
                </Button>
              </HStack>
            </Stack>
          </>
        )}
      </Box>

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

      <Heading color="white" size="sm" mb={2}>Kommende</Heading>
      {upcoming.length === 0 ? (
        <Text color="gray.500" fontSize="sm" mb={8}>Ingenting planlagt endnu. Klik på en dag i kalenderen for at tilføje.</Text>
      ) : (
        <Stack divider={<Divider borderColor="gray.700" />} mb={8}>
          {upcoming.map((row) => (
            <CalendarRow
              key={row.rowKind === 'goal' ? `goal:${row.goal.id}` : row.entry.id}
              row={row}
              onStatus={setStatus}
              onRemoveEntry={removeEntry}
              onRemoveGoal={removeGoal}
            />
          ))}
        </Stack>
      )}

      {past.length > 0 && (
        <>
          <Heading color="white" size="sm" mb={2}>Tidligere</Heading>
          <Stack divider={<Divider borderColor="gray.700" />} mb={8}>
            {past.slice(0, 20).map((row) => (
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
        </>
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
        saving={saving}
        addingEventId={addingEventId}
        onClose={() => setSelectedDate(null)}
        onAddEntry={addEntry}
        onAddFromEvent={addFromEvent}
        onStatus={setStatus}
        onRemoveEntry={removeEntry}
        onRemoveGoal={removeGoal}
      />
    </Container>
  );
}
