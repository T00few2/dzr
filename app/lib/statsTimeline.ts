import { getPeriodWindow, shiftDay, StatsPeriod, type PeriodWindow } from './statsPeriods'
import { buildSnapshotSeries, type ChartPoint, type DatedPoint } from './statsSeries'

export type TimelinePoint<T extends DatedPoint> = ChartPoint<T> & {
  timestamp: number
  sourceDate?: string
  boundary?: 'before' | 'after'
}

export type ChartTimeline<T extends DatedPoint> = {
  points: TimelinePoint<T>[]
  start: string
  end: string
  domain: [number, number]
  extended: boolean
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

export function dateTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function formatChartDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}

export function buildChartTimeline<T extends DatedPoint>(
  rows: ChartPoint<T>[],
  window: PeriodWindow,
): ChartTimeline<T> {
  const points = rows
    .filter(row => isDateKey(row.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, timestamp: dateTimestamp(row.date) }))
  const first = points[0]?.date
  const last = points[points.length - 1]?.date
  const start = window.start ? (first && first < window.start ? first : window.start) : first ?? window.end
  const end = last && last > window.end ? last : window.end
  // A lone observation still needs a non-zero axis domain.
  const domain: [number, number] = [dateTimestamp(start === end ? shiftDay(start, -1) : start), dateTimestamp(end)]
  return {
    points, start, end, domain,
    extended: Boolean((window.start && start < window.start) || end > window.end),
  }
}

export function buildSnapshotTimeline<T extends DatedPoint>(
  rows: T[],
  window: PeriodWindow,
  now = new Date(),
): ChartTimeline<T> {
  const today = now.toISOString().slice(0, 10)
  const availableEnd = window.granularity === 'week'
    ? getPeriodWindow(StatsPeriod.All, now).end
    : today
  const observations = rows
    .filter(row => isDateKey(row.date) && row.date <= availableEnd)
    .map(row => ({ ...row, sourceDate: row.date }))
  // Sample the available history first, so a preceding observation is not lost.
  const available = buildSnapshotSeries(observations, { ...window, start: null, end: availableEnd })
  const selected = available.filter(row => (!window.start || row.date >= window.start) && row.date <= window.end)
  const start = window.start
  const before = start && !selected.some(row => row.date === start)
    ? available.filter(row => row.date < start).pop()
    : undefined
  const after = !selected.some(row => row.date === window.end)
    ? available.find(row => row.date > window.end)
    : undefined
  const points: (ChartPoint<T> & { sourceDate: string; boundary?: 'before' | 'after' })[] = [...selected]
  if (before) points.unshift({ ...before, boundary: 'before' })
  if (after) points.push({ ...after, boundary: 'after' })
  return buildChartTimeline(points, window)
}
