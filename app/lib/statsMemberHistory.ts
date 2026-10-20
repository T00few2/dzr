import type { MemberPoint } from './statsTypes'
import { isDateKey } from './statsTimeline'
import { shiftDay } from './statsPeriods'

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function normalizeMemberSnapshot(
  id: string,
  data: Record<string, unknown>,
  roleId: string,
): MemberPoint | null {
  const date = isDateKey(data.dateKey) ? data.dateKey : isDateKey(id) ? id : null
  if (!date || !isCount(data.memberCount)) return null
  const roleCounts = data.roleCounts as Record<string, unknown> | undefined
  const roleCount = roleId && roleCounts ? roleCounts[roleId] : undefined
  return {
    date,
    members: data.memberCount,
    clubMembers: isCount(data.clubMemberCount) ? data.clubMemberCount : isCount(roleCount) ? roleCount : null,
    presence: isCount(data.presenceCount) ? data.presenceCount : null,
    estimated: Boolean(data.estimated),
  }
}

export type MissingObservationRange = {
  series: 'members' | 'clubMembers'
  start: string
  end: string
  days: number
}

// Inspect raw observations, never the weekly samples or carried-forward values.
export function findMissingMemberObservations(
  rows: MemberPoint[],
  displayed: { start: string; end: string },
  now = new Date(),
): MissingObservationRange[] {
  const yesterday = shiftDay(now.toISOString().slice(0, 10), -1)
  const end = displayed.end < yesterday ? displayed.end : yesterday
  const gaps: MissingObservationRange[] = []
  for (const series of ['members', 'clubMembers'] as const) {
    const dates = rows.filter(row => isDateKey(row.date) && isCount(row[series])).map(row => row.date).sort()
    const first = dates[0]
    if (!first) continue
    const start = displayed.start > first ? displayed.start : first
    const observed = new Set(dates)
    let gap: MissingObservationRange | undefined
    for (let date = start; date <= end; date = shiftDay(date, 1)) {
      if (observed.has(date)) {
        gap = undefined
      } else if (gap) {
        gap.end = date
        gap.days += 1
      } else {
        gap = { series, start: date, end: date, days: 1 }
        gaps.push(gap)
      }
    }
  }
  return gaps
}
