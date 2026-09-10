'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Flex, Grid, HStack, Heading, IconButton, Text } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import type { ZwiftEventSummary } from '@/packages/shared/zwiftEvents';
import {
  KIND_COLORS,
  WEEKDAYS_DA,
  addMonths,
  dzrChipColor,
  eventsOnDate,
  formatMonthTitle,
  isEventAdded,
  monthCells,
  parseIso,
  todayIso,
  type Entry,
  type Goal,
} from './calendarShared';

const MAX_DESKTOP_CHIPS = 3;
const MAX_MOBILE_DOTS = 5;

type CellItem =
  | { key: string; variant: 'goal'; label: string }
  | { key: string; variant: 'entry'; label: string; color: string; dimmed: boolean }
  | { key: string; variant: 'dzr'; label: string; color: string };

function itemsForDay(iso: string, entries: Entry[], goals: Goal[], events: ZwiftEventSummary[]): CellItem[] {
  const items: CellItem[] = [];
  for (const goal of goals.filter((g) => g.eventDate === iso)) {
    items.push({ key: `goal:${goal.id}`, variant: 'goal', label: goal.text });
  }
  const dayEntries = entries
    .filter((entry) => entry.eventDate === iso)
    .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  for (const entry of dayEntries) {
    items.push({
      key: `entry:${entry.id}`,
      variant: 'entry',
      label: `${entry.startTime ? `${entry.startTime} ` : ''}${entry.text}`,
      color: KIND_COLORS[entry.kind],
      dimmed: entry.status !== 'planned',
    });
  }
  for (const event of eventsOnDate(events, iso)) {
    if (isEventAdded(entries, event)) continue;
    items.push({
      key: `dzr:${event.id}`,
      variant: 'dzr',
      label: event.name,
      color: dzrChipColor(event),
    });
  }
  return items;
}

function Chip({ item }: { item: CellItem }) {
  if (item.variant === 'goal') {
    return (
      <Text
        px={1}
        py="1px"
        rounded="sm"
        fontSize="10px"
        lineHeight="1.3"
        bg="yellow.500"
        color="black"
        fontWeight="semibold"
        noOfLines={1}
      >
        ⭐ {item.label}
      </Text>
    );
  }
  if (item.variant === 'dzr') {
    return (
      <Text
        px={1}
        py="1px"
        rounded="sm"
        fontSize="10px"
        lineHeight="1.3"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor={`${item.color}.400`}
        color={`${item.color}.200`}
        noOfLines={1}
      >
        + {item.label}
      </Text>
    );
  }
  return (
    <Text
      px={1}
      py="1px"
      rounded="sm"
      fontSize="10px"
      lineHeight="1.3"
      bg={`${item.color}.500`}
      color="white"
      opacity={item.dimmed ? 0.55 : 1}
      noOfLines={1}
    >
      {item.label}
    </Text>
  );
}

function Dot({ item }: { item: CellItem }) {
  if (item.variant === 'goal') {
    return <Box w="7px" h="7px" rounded="full" bg="yellow.400" flexShrink={0} />;
  }
  if (item.variant === 'dzr') {
    return (
      <Box
        w="7px"
        h="7px"
        rounded="full"
        borderWidth="1.5px"
        borderColor={`${item.color}.400`}
        flexShrink={0}
      />
    );
  }
  return (
    <Box
      w="7px"
      h="7px"
      rounded="full"
      bg={`${item.color}.400`}
      opacity={item.dimmed ? 0.5 : 1}
      flexShrink={0}
    />
  );
}

export default function MonthGrid({
  entries,
  goals,
  events,
  selectedIso,
  onSelectDate,
}: {
  entries: Entry[];
  goals: Goal[];
  events: ZwiftEventSummary[];
  selectedIso: string | null;
  onSelectDate: (iso: string) => void;
}) {
  const today = todayIso();
  const initial = parseIso(today);
  const [cursor, setCursor] = useState({ y: initial.y, m: initial.m });

  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor.y, cursor.m]);
  const itemsByIso = useMemo(() => {
    const map = new Map<string, CellItem[]>();
    for (const cell of cells) {
      map.set(cell.iso, itemsForDay(cell.iso, entries, goals, events));
    }
    return map;
  }, [cells, entries, goals, events]);

  function goToday() {
    const now = parseIso(todayIso());
    setCursor({ y: now.y, m: now.m });
  }

  return (
    <Box>
      <Flex align="center" gap={2} mb={3} flexWrap="wrap">
        <IconButton
          aria-label="Forrige måned"
          icon={<ChevronLeftIcon />}
          size="sm"
          variant="ghost"
          color="gray.200"
          onClick={() => setCursor((c) => addMonths(c.y, c.m, -1))}
        />
        <Heading color="white" size="md" textTransform="capitalize" flex="1" textAlign="center" minW="12rem">
          {formatMonthTitle(cursor.y, cursor.m)}
        </Heading>
        <HStack>
          <Button size="sm" variant="outline" color="gray.200" borderColor="gray.600" onClick={goToday}>
            I dag
          </Button>
          <IconButton
            aria-label="Næste måned"
            icon={<ChevronRightIcon />}
            size="sm"
            variant="ghost"
            color="gray.200"
            onClick={() => setCursor((c) => addMonths(c.y, c.m, 1))}
          />
        </HStack>
      </Flex>

      <Grid templateColumns="repeat(7, 1fr)" gap="1px" bg="gray.700" borderWidth="1px" borderColor="gray.700" rounded="md" overflow="hidden">
        {WEEKDAYS_DA.map((day) => (
          <Box key={day} bg="gray.900" py={2} textAlign="center">
            <Text color="gray.400" fontSize="xs" textTransform="uppercase" letterSpacing="wide">
              {day}
            </Text>
          </Box>
        ))}
        {cells.map((cell) => {
          const dayNum = parseIso(cell.iso).d;
          const isToday = cell.iso === today;
          const isSelected = cell.iso === selectedIso;
          const items = itemsByIso.get(cell.iso) || [];
          const desktopExtra = Math.max(0, items.length - MAX_DESKTOP_CHIPS);
          const mobileExtra = Math.max(0, items.length - MAX_MOBILE_DOTS);
          return (
            <Box
              key={cell.iso}
              as="button"
              type="button"
              onClick={() => onSelectDate(cell.iso)}
              aria-label={formatAria(cell.iso, items.length, isToday)}
              w="100%"
              minW={0}
              display="flex"
              flexDirection="column"
              alignItems="flex-start"
              bg={cell.inMonth ? 'gray.900' : 'black'}
              minH={{ base: '56px', md: '108px' }}
              p={{ base: 1, md: 1.5 }}
              textAlign="left"
              overflow="hidden"
              border="none"
              cursor="pointer"
              h="100%"
              opacity={cell.inMonth ? 1 : 0.45}
              _hover={{ bg: 'gray.800' }}
              _focusVisible={{ outline: '2px solid', outlineColor: 'red.500', zIndex: 1 }}
            >
              <Flex
                align="center"
                justify="center"
                w={{ base: 6, md: 7 }}
                h={{ base: 6, md: 7 }}
                mb={1}
                rounded="full"
                fontSize="sm"
                fontWeight={isToday ? 'bold' : 'medium'}
                bg={isToday ? 'red.600' : undefined}
                color={isToday ? 'white' : 'gray.200'}
                boxShadow={isSelected && !isToday ? '0 0 0 2px var(--chakra-colors-red-500)' : undefined}
              >
                {dayNum}
              </Flex>
              <HStack display={{ base: 'flex', md: 'none' }} spacing="3px" flexWrap="wrap">
                {items.slice(0, MAX_MOBILE_DOTS).map((item) => (
                  <Dot key={item.key} item={item} />
                ))}
                {mobileExtra > 0 && (
                  <Text color="gray.500" fontSize="9px">+{mobileExtra}</Text>
                )}
              </HStack>
              <Box display={{ base: 'none', md: 'block' }}>
                {items.slice(0, MAX_DESKTOP_CHIPS).map((item) => (
                  <Box key={item.key} mb="2px">
                    <Chip item={item} />
                  </Box>
                ))}
                {desktopExtra > 0 && (
                  <Text color="gray.500" fontSize="10px" pl={1}>+{desktopExtra}</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
}

function formatAria(iso: string, count: number, isToday: boolean) {
  const date = new Date(`${iso}T12:00:00Z`);
  const day = new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const todayBit = isToday ? ', i dag' : '';
  if (count === 0) return `${day}${todayBit}. Klik for at tilføje.`;
  return `${day}${todayBit}. ${count} ${count === 1 ? 'ting' : 'ting'}. Klik for at åbne.`;
}
