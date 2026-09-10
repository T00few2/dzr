'use client';

import { Badge, Box, Button, Flex, HStack, IconButton, Text } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { KIND_COLORS, KIND_LABELS, formatDay, type Entry, type Goal, type Row } from './calendarShared';

export function CalendarEntryRow({
  entry,
  dimmed = false,
  showDate = true,
  onStatus,
  onRemove,
}: {
  entry: Entry;
  dimmed?: boolean;
  showDate?: boolean;
  onStatus: (id: string, next: Entry['status']) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Flex
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
        {showDate && (
          <Text color="gray.500" fontSize="xs">{formatDay(entry.eventDate)}</Text>
        )}
      </Box>
      <HStack spacing={1} flexShrink={0}>
        <Button
          size="xs"
          variant="ghost"
          color="gray.300"
          onClick={() => onStatus(entry.id, entry.status === 'done' ? 'planned' : 'done')}
        >
          {entry.status === 'done' ? 'Fortryd' : 'Gennemført'}
        </Button>
        <IconButton
          aria-label="Slet"
          icon={<DeleteIcon />}
          size="xs"
          variant="ghost"
          color="gray.400"
          onClick={() => onRemove(entry.id)}
        />
      </HStack>
    </Flex>
  );
}

export function CalendarGoalRow({
  goal,
  showDate = true,
  onRemove,
}: {
  goal: Goal;
  showDate?: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <Flex
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
        {showDate && (
          <Text color="gray.500" fontSize="xs">{formatDay(goal.eventDate)}</Text>
        )}
      </Box>
      <IconButton
        aria-label="Slet mål"
        icon={<DeleteIcon />}
        size="xs"
        variant="ghost"
        color="gray.400"
        flexShrink={0}
        onClick={() => onRemove(goal.id)}
      />
    </Flex>
  );
}

export function CalendarRow({
  row,
  dimmed = false,
  showDate = true,
  onStatus,
  onRemoveEntry,
  onRemoveGoal,
}: {
  row: Row;
  dimmed?: boolean;
  showDate?: boolean;
  onStatus: (id: string, next: Entry['status']) => void;
  onRemoveEntry: (id: string) => void;
  onRemoveGoal: (id: string) => void;
}) {
  if (row.rowKind === 'goal') {
    return <CalendarGoalRow goal={row.goal} showDate={showDate} onRemove={onRemoveGoal} />;
  }
  return (
    <CalendarEntryRow
      entry={row.entry}
      dimmed={dimmed}
      showDate={showDate}
      onStatus={onStatus}
      onRemove={onRemoveEntry}
    />
  );
}
