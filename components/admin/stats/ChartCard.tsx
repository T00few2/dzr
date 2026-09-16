import { Box, Flex, Heading, Skeleton, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export const CHART_HEIGHT = 240

export default function ChartCard({
  title,
  actions,
  children,
  empty,
  isEmpty,
  loading,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  empty: string
  isEmpty?: boolean
  loading?: boolean
}) {
  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={5} bg="gray.900" h="100%">
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Heading size="sm">{title}</Heading>
        {actions}
      </Flex>
      {loading ? (
        <Skeleton h={`${CHART_HEIGHT}px`} rounded="md" />
      ) : isEmpty ? (
        <Flex h={`${CHART_HEIGHT}px`} align="center" justify="center" px={4}>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            {empty}
          </Text>
        </Flex>
      ) : (
        children
      )}
    </Box>
  )
}
