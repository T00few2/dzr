export enum StatsPeriod {
  Last30Days = '30d',
  Last90Days = '90d',
  LastYear = '1y',
  LastThreeYears = '3y',
  All = 'all',
}

export const STATS_PERIODS = Object.values(StatsPeriod)

type PeriodDefinition =
  | { granularity: 'day'; count: number }
  | { granularity: 'week'; count: number | null }

export type PeriodWindow = {
  selection: StatsPeriod
  granularity: 'day' | 'week'
  start: string | null
  end: string
}

export function parseStatsPeriod(value: string | null): StatsPeriod {
  return STATS_PERIODS.find(period => period === value) ?? StatsPeriod.Last30Days
}

export function getPeriodDefinition(period: StatsPeriod): PeriodDefinition {
  switch (period) {
    case StatsPeriod.Last30Days:
      return { granularity: 'day', count: 30 }
    case StatsPeriod.Last90Days:
      return { granularity: 'day', count: 90 }
    case StatsPeriod.LastYear:
      return { granularity: 'week', count: 53 }
    case StatsPeriod.LastThreeYears:
      return { granularity: 'week', count: 157 }
    case StatsPeriod.All:
      return { granularity: 'week', count: null }
    default: {
      const unsupported: never = period
      throw new Error(`Unsupported stats period: ${unsupported}`)
    }
  }
}

export function periodLabel(period: StatsPeriod): string {
  const { granularity, count } = getPeriodDefinition(period)
  if (count === null) return 'all full weeks'
  return granularity === 'day' ? `last ${count} days` : `last ${count} full weeks`
}

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekStart(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  return shiftDay(day, -daysSinceMonday)
}

export function getPeriodWindow(period: StatsPeriod, now = new Date()): PeriodWindow {
  const definition = getPeriodDefinition(period)
  const today = now.toISOString().slice(0, 10)

  if (definition.granularity === 'day') {
    return { selection: period, granularity: 'day', start: shiftDay(today, 1 - definition.count), end: today }
  }

  const currentWeekStart = weekStart(today)
  return {
    selection: period,
    granularity: 'week',
    start: definition.count === null ? null : shiftDay(currentWeekStart, -7 * definition.count),
    end: shiftDay(currentWeekStart, -1),
  }
}

// Weekly histories begin with the first complete Monday–Sunday week.
export function getHistoryStart(window: PeriodWindow, firstDate: string | undefined): string | null {
  if (!firstDate) return null

  let start = firstDate
  if (window.granularity === 'week') {
    const monday = weekStart(firstDate)
    start = monday === firstDate ? monday : shiftDay(monday, 7)
  }
  if (window.start && window.start > start) start = window.start
  return start <= window.end ? start : null
}
