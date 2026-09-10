'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { MAX_ENTRY_TEXT } from '@/app/lib/memberCalendar';
import { suggestedSubgroup } from '@/packages/shared/zwiftEvents';
import type { ZwiftEventSummary, ZwiftEventSubgroup } from '@/packages/shared/zwiftEvents';
import { CalendarRow } from './CalendarRow';
import {
  eventsOnDate,
  formatDay,
  isSubgroupAdded,
  sortAgendaRows,
  todayIso,
  type Entry,
  type Goal,
} from './calendarShared';

export default function DayModal({
  date,
  entries,
  goals,
  events,
  racingScore,
  saving,
  addingEventId,
  onClose,
  onAddEntry,
  onAddFromEvent,
  onStatus,
  onRemoveEntry,
  onRemoveGoal,
}: {
  date: string | null;
  entries: Entry[];
  goals: Goal[];
  events: ZwiftEventSummary[];
  racingScore: number | null;
  saving: boolean;
  addingEventId: number | null;
  onClose: () => void;
  onAddEntry: (payload: {
    text: string;
    eventDate: string;
    startTime: string | null;
    kind: Entry['kind'];
  }) => Promise<boolean>;
  onAddFromEvent: (event: ZwiftEventSummary, subgroup: ZwiftEventSubgroup) => Promise<void>;
  onStatus: (id: string, next: Entry['status']) => void;
  onRemoveEntry: (id: string) => void;
  onRemoveGoal: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [kind, setKind] = useState<Entry['kind']>('session');

  useEffect(() => {
    setText('');
    setTime('');
    setKind('session');
  }, [date]);

  const today = todayIso();
  const canAdd = Boolean(date && date >= today);
  const dayEvents = useMemo(() => (date ? eventsOnDate(events, date) : []), [events, date]);
  const dayRows = useMemo(() => {
    if (!date) return [];
    return sortAgendaRows(
      entries.filter((entry) => entry.eventDate === date),
      goals.filter((goal) => goal.eventDate === date),
    );
  }, [date, entries, goals]);

  const canSubmit = canAdd && text.trim().length > 0 && !saving;

  async function submit() {
    if (!date || !canSubmit) return;
    const ok = await onAddEntry({
      text: text.trim(),
      eventDate: date,
      startTime: time || null,
      kind,
    });
    if (ok) {
      setText('');
      setTime('');
    }
  }

  return (
    <Modal isOpen={Boolean(date)} onClose={onClose} size={{ base: 'full', md: 'lg' }} scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(2px)" />
      <ModalContent bg="gray.900" color="white" border="1px solid" borderColor="gray.700" rounded={{ base: 0, md: 'md' }}>
        <ModalHeader textTransform="capitalize" pr={12}>
          {date ? formatDay(date) : ''}
        </ModalHeader>
        <ModalCloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} />
        <ModalBody pb={6}>
          {!date ? null : (
            <Stack spacing={6}>
              {dayEvents.length > 0 && (
                <Box>
                  <Heading color="white" size="sm" mb={1}>DZR den dag</Heading>
                  <Text color="gray.400" fontSize="sm" mb={3}>
                    Vælg din kategori — hver kategori har sit eget starttidspunkt.
                    {racingScore != null && ` Din Racing Score er ${Math.round(racingScore)}.`}
                  </Text>
                  <Stack spacing={3}>
                    {dayEvents.map((event) => {
                      const likely = suggestedSubgroup(event, racingScore);
                      return (
                        <Box
                          key={event.id}
                          bg="gray.800"
                          borderWidth="1px"
                          borderColor="gray.700"
                          rounded="md"
                          p={3}
                        >
                          <HStack justify="space-between" align="start" mb={2} gap={2}>
                            <Box minW={0}>
                              <Text color="white" fontWeight="bold" noOfLines={1}>{event.name}</Text>
                              <Text color="gray.500" fontSize="xs">
                                {event.distanceKm ? `${event.distanceKm} km` : ''}
                                {event.distanceKm && event.durationMinutes ? ' · ' : ''}
                                {event.durationMinutes ? `${event.durationMinutes} min` : ''}
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
                              onClick={(e) => e.stopPropagation()}
                            >
                              Zwift <ExternalLinkIcon mb="2px" />
                            </Box>
                          </HStack>
                          <HStack flexWrap="wrap" spacing={2}>
                            {event.subgroups.map((subgroup) => {
                              const added = isSubgroupAdded(entries, event, subgroup);
                              return (
                                <Button
                                  key={subgroup.id}
                                  size="xs"
                                  variant={likely === subgroup.label ? 'solid' : 'outline'}
                                  colorScheme={likely === subgroup.label ? 'red' : 'gray'}
                                  color={likely === subgroup.label ? undefined : 'gray.300'}
                                  isDisabled={added}
                                  isLoading={addingEventId === event.id}
                                  onClick={() => onAddFromEvent(event, subgroup)}
                                  title={subgroup.scoreRange ? `Racing Score ${subgroup.scoreRange}` : subgroup.paceRange || undefined}
                                >
                                  {added ? '✓ ' : ''}{subgroup.label} · {subgroup.startTime}
                                </Button>
                              );
                            })}
                          </HStack>
                          {likely && (
                            <Text color="gray.500" fontSize="xs" mt={2}>
                              Ud fra din score ser {likely} ud til at passe — men vælg selv.
                            </Text>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {dayRows.length > 0 && (
                <Box>
                  <Heading color="white" size="sm" mb={1}>Din plan</Heading>
                  <Stack divider={<Divider borderColor="gray.700" />}>
                    {dayRows.map((row) => (
                      <CalendarRow
                        key={row.rowKind === 'goal' ? `goal:${row.goal.id}` : row.entry.id}
                        row={row}
                        showDate={false}
                        onStatus={onStatus}
                        onRemoveEntry={onRemoveEntry}
                        onRemoveGoal={onRemoveGoal}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {canAdd ? (
                <Box>
                  <Heading color="white" size="sm" mb={3}>Tilføj selv</Heading>
                  <Stack spacing={2}>
                    <Input
                      placeholder="Fx 2 timer roligt"
                      value={text}
                      maxLength={MAX_ENTRY_TEXT}
                      onChange={(e) => setText(e.target.value)}
                      bg="gray.800"
                      borderColor="gray.600"
                      size="sm"
                    />
                    <HStack flexWrap="wrap">
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
                      <Button size="sm" colorScheme="red" onClick={submit} isLoading={saving} isDisabled={!canSubmit}>
                        Tilføj
                      </Button>
                    </HStack>
                  </Stack>
                </Box>
              ) : dayRows.length > 0 ? (
                <Text color="gray.500" fontSize="sm">
                  Tidligere dage kan ikke få nye poster — du kan stadig markere gennemført eller slette.
                </Text>
              ) : (
                <Text color="gray.500" fontSize="sm">Ingenting den dag.</Text>
              )}
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
