import { Box, Text } from '@chakra-ui/react'
import type { MissingObservationRange } from '@/app/lib/statsMemberHistory'
import { formatChartDate } from '@/app/lib/statsTimeline'

export default function MissingObservations({ ranges }: { ranges: MissingObservationRange[] }) {
  if (!ranges.length) return null

  return (
    <Box as="details" mt={6} borderWidth="1px" borderColor="yellow.700" rounded="md" p={3}>
      <Box
        as="summary"
        color="yellow.200"
        fontSize="sm"
        fontWeight="semibold"
        cursor="pointer"
        _focusVisible={{ outline: '2px solid', outlineColor: 'yellow.200', outlineOffset: '3px' }}
      >
        Missing observations
      </Box>
      <Box pt={3}>
        <Text fontSize="sm" color="gray.300" mb={2}>
          No observations are available for these dates in the displayed member timeline.
          Lines connect known counts; weekly values can reuse earlier observations.
        </Text>
        <Box as="ul" pl={5}>
          {ranges.map(range => (
            <Box as="li" key={`${range.series}-${range.start}`} fontSize="sm" mb={1}>
              {range.series === 'members' ? 'Discord members' : 'Club member role'} ·{' '}
              {formatChartDate(range.start)}
              {range.start !== range.end ? `–${formatChartDate(range.end)}` : ''} ·{' '}
              {range.days} {range.days === 1 ? 'day' : 'days'}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
