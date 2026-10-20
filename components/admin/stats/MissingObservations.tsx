import { Box, Button, Collapse, Text } from '@chakra-ui/react'
import { useId, useState } from 'react'
import type { MissingObservationRange } from '@/app/lib/statsMemberHistory'
import { formatChartDate } from '@/app/lib/statsTimeline'

export default function MissingObservations({ ranges }: { ranges: MissingObservationRange[] }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  if (!ranges.length) return null

  return (
    <Box mt={6} borderWidth="1px" borderColor="yellow.700" rounded="md" p={3}>
      <Button
        variant="link"
        color="yellow.200"
        size="sm"
        whiteSpace="normal"
        textAlign="left"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded(value => !value)}
      >
        Missing observations · {expanded ? 'Hide details' : 'View details'}
      </Button>
      <Collapse in={expanded}>
        <Box id={detailsId} pt={3}>
          <Text fontSize="sm" color="gray.300" mb={2}>
            No daily observations were recorded for these dates in the displayed member timeline.
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
      </Collapse>
    </Box>
  )
}
