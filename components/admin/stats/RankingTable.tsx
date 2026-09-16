import { Box, Heading, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'

export default function RankingTable({
  title,
  rows,
  empty,
  loading,
}: {
  title: string
  rows: { id?: string; name: string; total: number; detail?: string }[]
  empty: string
  loading?: boolean
}) {
  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={5} bg="gray.900" h="100%">
      <Heading size="sm" mb={3}>{title}</Heading>
      {loading ? (
        <Text color="gray.500" fontSize="sm">Loading…</Text>
      ) : !rows.length ? (
        <Text color="gray.500" fontSize="sm">{empty}</Text>
      ) : (
        <Table size="sm" variant="unstyled">
          <Thead>
            <Tr>
              <Th color="gray.500" px={0} pb={2}>Name</Th>
              <Th color="gray.500" px={0} pb={2} isNumeric>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.id || row.name}>
                <Td px={0} py={1.5} borderColor="gray.800">
                  <Text>{row.name}</Text>
                  {row.detail ? (
                    <Text color="gray.500" fontSize="xs">{row.detail}</Text>
                  ) : null}
                </Td>
                <Td px={0} py={1.5} borderColor="gray.800" isNumeric>
                  <Text fontFamily="mono">{row.total.toLocaleString()}</Text>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  )
}
