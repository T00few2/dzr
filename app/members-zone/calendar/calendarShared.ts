import type { ZwiftEventSummary, ZwiftEventSubgroup } from '@/packages/shared/zwiftEvents';

export type Entry = {
  id: string;
  eventDate: string;
  text: string;
  kind: 'session' | 'race' | 'event' | 'other';
  startTime: string | null;
  source: 'member' | 'coach';
  status: 'planned' | 'done' | 'skipped';
  sourceEventId?: string | null;
};

export type Goal = { id: string; text: string; eventDate: string; expired?: boolean };

/**
 * One row of the agenda. Goals and entries come from different collections with independent id
 * spaces, so the discriminator is what stops a delete going to the wrong endpoint.
 */
export type Row =
  | { rowKind: 'entry'; entry: Entry; eventDate: string; startTime: string | null }
  | { rowKind: 'goal'; goal: Goal; eventDate: string; startTime: null };

export const MAX_ACTIVE_GOALS = 3;

export const KIND_LABELS: Record<Entry['kind'], string> = {
  session: 'Træning',
  race: 'Løb',
  event: 'Event',
  other: 'Andet',
};

export const KIND_COLORS: Record<Entry['kind'], string> = {
  session: 'blue',
  race: 'red',
  event: 'purple',
  other: 'gray',
};

export const WEEKDAYS_DA = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'] as const;

export type MonthCell = { iso: string; inMonth: boolean };

/** Copenhagen's date, so "i dag" matches the club's day rather than the browser's timezone. */
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Copenhagen',
  }).format(new Date());
}

export function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addMonths(y: number, m: number, delta: number) {
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
}

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Monday = 0 … Sunday = 6. The YYYY-MM-DD is a civil date, so noon UTC is a safe weekday. */
export function weekdayMonday0(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return (date.getUTCDay() + 6) % 7;
}

/** Six weeks, Monday-first, so the grid height stays put while paging months. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = isoFromParts(year, month, 1);
  const startOffset = weekdayMonday0(first);
  const dim = daysInMonth(year, month);
  const cells: MonthCell[] = [];

  const prev = addMonths(year, month, -1);
  const prevDim = daysInMonth(prev.y, prev.m);
  for (let i = startOffset - 1; i >= 0; i -= 1) {
    cells.push({ iso: isoFromParts(prev.y, prev.m, prevDim - i), inMonth: false });
  }
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ iso: isoFromParts(year, month, d), inMonth: true });
  }
  const next = addMonths(year, month, 1);
  let n = 1;
  while (cells.length < 42) {
    cells.push({ iso: isoFromParts(next.y, next.m, n), inMonth: false });
    n += 1;
  }
  return cells;
}

export function formatDay(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatMonthTitle(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat('da-DK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function eventsOnDate(events: ZwiftEventSummary[], iso: string) {
  return events.filter(
    (event) => event.eventDate === iso || event.subgroups.some((sub) => sub.eventDate === iso),
  );
}

export function isSubgroupAdded(
  entries: Entry[],
  event: ZwiftEventSummary,
  subgroup: ZwiftEventSubgroup,
) {
  const sourceId = `${event.id}:${subgroup.id}`;
  if (entries.some((entry) => entry.sourceEventId && entry.sourceEventId === sourceId)) return true;
  const label = `${event.name} (${subgroup.label})`.trim().toLowerCase();
  return entries.some(
    (entry) => entry.eventDate === subgroup.eventDate && entry.text.trim().toLowerCase() === label,
  );
}

export function isEventAdded(entries: Entry[], event: ZwiftEventSummary) {
  return event.subgroups.some((subgroup) => isSubgroupAdded(entries, event, subgroup));
}

export function dzrChipColor(event: ZwiftEventSummary) {
  return event.eventType === 'RACE' ? 'red' : 'purple';
}

export function sortAgendaRows(entries: Entry[], goals: Goal[]): Row[] {
  return [
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
    if (a.rowKind !== b.rowKind) return a.rowKind === 'goal' ? -1 : 1;
    return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
  });
}
