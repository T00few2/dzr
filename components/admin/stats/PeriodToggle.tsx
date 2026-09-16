import { Button, HStack } from '@chakra-ui/react'
import type { PeriodDays } from './types'

const OPTIONS: { value: PeriodDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 'all', label: 'All time' },
]

export function seriesStartDay(period: PeriodDays): string | null {
  if (period === 'all') return null
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - (period - 1))
  return d.toISOString().slice(0, 10)
}

export function sliceSeries<T>(rows: T[], dayOf: (row: T) => string, period: PeriodDays): T[] {
  const start = seriesStartDay(period)
  if (!start) return rows
  return rows.filter((row) => dayOf(row) >= start)
}

export function periodLabel(period: PeriodDays): string {
  return period === 'all' ? 'all time' : `last ${period} days`
}

export default function PeriodToggle({ value, onChange }: { value: PeriodDays; onChange: (d: PeriodDays) => void }) {
  return (
    <HStack spacing={1} flexShrink={0}>
      {OPTIONS.map((opt) => (
        <Button
          key={String(opt.value)}
          size="xs"
          colorScheme="red"
          variant={value === opt.value ? 'solid' : 'outline'}
          borderColor="red.400"
          color={value === opt.value ? undefined : 'red.200'}
          _hover={value === opt.value ? undefined : { bg: 'whiteAlpha.100', borderColor: 'red.300', color: 'red.100' }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </HStack>
  )
}
