import { getHistoryStart, getSnapshotStart, shiftDay, weekStart, type PeriodWindow } from './statsPeriods'

export type DatedPoint = { date: string }
export type WeekRange = { weekStart: string; weekEnd: string }
export type ChartPoint<T extends DatedPoint> = T & Partial<WeekRange>

export type ActivityPoint = ChartPoint<{
  date: string
  messages: number
  reactions: number
  voice: number
  interactions: number
  total: number
}>

function isInWindow(date: string, window: PeriodWindow): boolean {
  return (!window.start || date >= window.start) && date <= window.end
}

// Counts are snapshots: use the last known count at each finished Sunday, never sum them.
export function buildSnapshotSeries<T extends DatedPoint>(rows: T[], window: PeriodWindow): ChartPoint<T>[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  if (window.granularity === 'day') return sorted.filter(row => isInWindow(row.date, window))

  const start = getSnapshotStart(window, sorted[0]?.date)
  if (!start) return []

  const result: ChartPoint<T>[] = []
  let index = 0
  let latest: T | undefined
  for (let monday = start; monday <= window.end; monday = shiftDay(monday, 7)) {
    const sunday = shiftDay(monday, 6)
    while (index < sorted.length && sorted[index].date <= sunday) {
      latest = sorted[index]
      index += 1
    }
    if (latest) result.push({ ...latest, date: sunday, weekStart: monday, weekEnd: sunday })
  }
  return result
}

// Activity is additive. The API supplies daily rows, including zero-activity days.
export function buildActivitySeries(rows: ActivityPoint[], window: PeriodWindow): ActivityPoint[] {
  const daily = rows.filter(row => isInWindow(row.date, window))
  if (window.granularity === 'day') return daily

  const firstDate = daily.map(row => row.date).sort()[0]
  const start = window.start ?? getHistoryStart(window, firstDate)
  if (!start) return []

  const weeks = new Map<string, ActivityPoint>()
  for (const row of daily) {
    const monday = weekStart(row.date)
    const sunday = shiftDay(monday, 6)
    if (sunday > window.end || monday < start) continue

    const week = weeks.get(monday) ?? {
      date: sunday, weekStart: monday, weekEnd: sunday,
      messages: 0, reactions: 0, voice: 0, interactions: 0, total: 0,
    }
    week.messages += row.messages
    week.reactions += row.reactions
    week.voice += row.voice
    week.interactions += row.interactions
    week.total += row.total
    weeks.set(monday, week)
  }
  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date))
}
