import { getPeriodWindow, shiftDay, StatsPeriod, type PeriodWindow } from './statsPeriods'
import { buildSnapshotSeries, type ChartPoint, type DatedPoint } from './statsSeries'

export type TimelinePoint<T extends DatedPoint> = ChartPoint<T> & {
  timestamp: number
  sourceDate?: string
  boundary?: 'before' | 'after'
  openWeek?: boolean
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
  const first = points[0]?.weekStart ?? points[0]?.date
  const start = window.start ?? first ?? window.end
  const end = window.end
  // A lone observation still needs a non-zero axis domain.
  const domain: [number, number] = [dateTimestamp(start === end ? shiftDay(start, -1) : start), dateTimestamp(end)]
  return {
    points, start, end, domain,
    extended: points.some(point => (window.start && point.date < window.start) || point.date > window.end),
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

  // Weekly sampling already carries earlier observations into the first Sunday.
  // Adding a boundary week here would turn 53/157 weeks into 54/158.
  if (window.granularity === 'week') {
    return buildChartTimeline(buildSnapshotSeries(observations, window), window)
  }

  const available = observations.sort((a, b) => a.date.localeCompare(b.date))
  const selected = available.filter(row => (!window.start || row.date >= window.start) && row.date <= window.end)
  const points: (ChartPoint<T> & { sourceDate: string; boundary?: 'before' | 'after' })[] = [...selected]
  // Hold the nearest known count on the window edges. The axis stays on the
  // selected period instead of stretching out to that observation's real date.
  const windowStart = window.start
  if (windowStart && points[0]?.date !== windowStart) {
    const before = available.filter(row => row.date < windowStart).at(-1)
    if (before) points.unshift({ ...before, date: windowStart, boundary: 'before' })
  }
  const last = points.at(-1)
  if (last && last.date !== window.end && window.end <= availableEnd) {
    points.push({ ...last, date: window.end, boundary: 'after' })
  }
  return buildChartTimeline(points, window)
}
