import { Button, HStack } from '@chakra-ui/react'
import { STATS_PERIODS, type StatsPeriod } from '@/app/lib/statsPeriods'

export default function PeriodToggle({ value, onChange }: {
  value: StatsPeriod
  onChange: (period: StatsPeriod) => void
}) {
  return (
    <HStack spacing={1} flexShrink={0}>
      {STATS_PERIODS.map((period) => (
        <Button
          key={period}
          size="xs"
          colorScheme="red"
          variant={value === period ? 'solid' : 'outline'}
          borderColor="red.400"
          color={value === period ? undefined : 'red.200'}
          _hover={value === period ? undefined : { bg: 'whiteAlpha.100', borderColor: 'red.300', color: 'red.100' }}
          onClick={() => onChange(period)}
        >
          {period}
        </Button>
      ))}
    </HStack>
  )
}
