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
import { DeleteIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import { MAX_ENTRY_TEXT } from '@/app/lib/memberCalendar';
import { suggestedSubgroup } from '@/packages/shared/zwiftEvents';
import type { ZwiftEventSummary, ZwiftEventSubgroup } from '@/packages/shared/zwiftEvents';

type Entry = {
  id: string;
  eventDate: string;
  text: string;
  kind: 'session' | 'race' | 'event' | 'other';
  startTime: string | null;
  source: 'member' | 'coach';
  status: 'planned' | 'done' | 'skipped';
};

type Goal = { id: string; text: string; eventDate: string; expired?: boolean };

/**
 * One row of the agenda. Goals and entries come from different collections with independent id
 * spaces, so the discriminator is what stops a delete going to the wrong endpoint.
 */
type Row =
  | { rowKind: 'entry'; entry: Entry; eventDate: string; startTime: string | null }
  | { rowKind: 'goal'; goal: Goal; eventDate: string; startTime: null };

const MAX_ACTIVE_GOALS = 3;

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
  //
  // Goals are merged into the same list rather than kept in a block of their own: a goal is a
  // dated thing the member is working toward, so it belongs in the run of dates, marked with a
  // star. Expired goals fall into Tidligere by the same date rule as everything else, which is
  // where they can be deleted.
  const { upcoming, past } = useMemo(() => {
    const today = todayIso();
    const rows: Row[] = [
      ...entries.map((entry): Row => ({
        rowKind: 'entry',
        entry,
        eventDate: entry.eventDate,
        startTime: entry.startTime,
      })),
      ...goals.map((goal): Row => ({
        rowKind: 'goal',
        goal,
        eventDate: goal.eventDate,
        startTime: null,
      })),
    ].sort((a, b) => {
      const byDate = a.eventDate.localeCompare(b.eventDate);
      if (byDate !== 0) return byDate;
      // A goal is the anchor for its day, so it leads; then timed rows, then untimed.
      if (a.rowKind !== b.rowKind) return a.rowKind === 'goal' ? -1 : 1;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });
    return {
      upcoming: rows.filter((r) => r.eventDate >= today),
      past: rows.filter((r) => r.eventDate < today).reverse(),
    };
  }, [entries, goals]);

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

  const renderGoal = (goal: Goal) => (
    <Flex
      key={`goal:${goal.id}`}
      align="center"
      justify="space-between"
      gap={3}
      py={2}
      opacity={goal.expired ? 0.6 : 1}
    >
      <Box minW={0}>
        <HStack spacing={2} mb={1} flexWrap="wrap">
          <Text fontSize="sm" aria-label="Mål" role="img">⭐</Text>
          <Badge colorScheme="yellow">Mål</Badge>
          {goal.expired && <Badge variant="subtle" colorScheme="gray">udløbet</Badge>}
        </HStack>
        <Text color="white" fontWeight="bold" noOfLines={2}>{goal.text}</Text>
        <Text color="gray.500" fontSize="xs">{formatDay(goal.eventDate)}</Text>
      </Box>
      <IconButton
        aria-label="Slet mål"
        icon={<DeleteIcon />}
        size="xs"
        variant="ghost"
        color="gray.400"
        flexShrink={0}
        onClick={() => removeGoal(goal.id)}
      />
    </Flex>
  );

  const renderRow = (row: Row, dimmed = false) =>
    row.rowKind === 'goal' ? renderGoal(row.goal) : renderEntry(row.entry, dimmed);

  return (
    <Container maxW="4xl" py={8}>
      <Heading color="white" size="xl" mb={2}>Kalender</Heading>
      <Text color="gray.400" mb={6}>
        Din egen plan: træning, løb og events. Kun du kan se den. Har du DZR Coach slået til,
        kan coachen også se den og tage højde for den.
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

      {(events.length > 0 || eventsUnavailable) && (
        <Box mb={8}>
          <Heading color="white" size="sm" mb={1}>DZR-løb i denne uge</Heading>
          {eventsUnavailable ? (
            <Text color="gray.500" fontSize="sm">
              Kunne ikke hente løbene fra Zwift lige nu. Du kan stadig tilføje dem manuelt ovenfor.
            </Text>
          ) : (
            <>
              <Text color="gray.400" fontSize="sm" mb={3}>
                Vælg din kategori — hver kategori har sit eget starttidspunkt.
                {racingScore != null && ` Din Racing Score er ${Math.round(racingScore)}.`}
              </Text>
              <Stack spacing={3}>
                {events.map((event) => {
                  const likely = suggestedSubgroup(event, racingScore);
                  const alreadyAdded = new Set(
                    entries
                      .filter((e) => e.eventDate === event.eventDate)
                      .map((e) => e.text.trim().toLowerCase())
                  );
                  return (
                    <Box
                      key={event.id}
                      bg="gray.900"
                      borderWidth="1px"
                      borderColor="gray.700"
                      rounded="md"
                      p={3}
                    >
                      <HStack justify="space-between" align="start" mb={2} gap={2}>
                        <Box minW={0}>
                          <Text color="white" fontWeight="bold" noOfLines={1}>{event.name}</Text>
                          <Text color="gray.500" fontSize="xs">
                            {formatDay(event.eventDate)}
                            {event.distanceKm ? ` · ${event.distanceKm} km` : ''}
                            {event.durationMinutes ? ` · ${event.durationMinutes} min` : ''}
                          </Text>
                        </Box>
                        <Box
                          as="a"
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="gray.400"
                          fontSize="xs"
                          flexShrink={0}
                        >
                          Zwift <ExternalLinkIcon mb="2px" />
                        </Box>
                      </HStack>
                      <HStack flexWrap="wrap" spacing={2}>
                        {event.subgroups.map((subgroup) => {
                          const added = alreadyAdded.has(`${event.name} (${subgroup.label})`.toLowerCase());
                          return (
                            <Button
                              key={subgroup.id}
                              size="xs"
                              variant={likely === subgroup.label ? 'solid' : 'outline'}
                              colorScheme={likely === subgroup.label ? 'red' : 'gray'}
                              color={likely === subgroup.label ? undefined : 'gray.300'}
                              isDisabled={added}
                              isLoading={addingEventId === event.id}
                              onClick={() => addFromEvent(event, subgroup)}
                              title={subgroup.scoreRange ? `Racing Score ${subgroup.scoreRange}` : subgroup.paceRange || undefined}
                            >
                              {added ? '✓ ' : ''}{subgroup.label} · {subgroup.startTime}
                            </Button>
                          );
                        })}
                      </HStack>
                      {likely && (
                        // A hint, not a choice. Stats go stale and plenty of members have no
                        // linked Zwift id, so the member always clicks the category themselves.
                        <Text color="gray.500" fontSize="xs" mt={2}>
                          Ud fra din score ser {likely} ud til at passe — men vælg selv.
                        </Text>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}
        </Box>
      )}

      <Heading color="white" size="sm" mb={2}>Kommende</Heading>
      {upcoming.length === 0 ? (
        <Text color="gray.500" fontSize="sm" mb={8}>Ingenting planlagt endnu.</Text>
      ) : (
        <Stack divider={<Divider borderColor="gray.700" />} mb={8}>
          {upcoming.map((row) => renderRow(row))}
        </Stack>
      )}

      {past.length > 0 && (
        <>
          <Heading color="white" size="sm" mb={2}>Tidligere</Heading>
          <Stack divider={<Divider borderColor="gray.700" />} mb={8}>
            {past.slice(0, 20).map((row) => renderRow(row, true))}
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
    </Container>
  );
}
