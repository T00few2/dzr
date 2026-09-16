import { Box, Skeleton, Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react'

export default function KpiCard({
  label,
  value,
  helper,
  loading,
}: {
  label: string
  value: string
  helper?: string
  loading?: boolean
}) {
  return (
    <Box borderWidth="1px" borderColor="gray.700" rounded="md" p={5} bg="gray.900">
      <Stat>
        <StatLabel color="gray.400">{label}</StatLabel>
        <StatNumber fontSize={{ base: '2xl', md: '3xl' }} letterSpacing="tight">
          {loading ? <Skeleton h="36px" w="88px" mt={1} /> : value}
        </StatNumber>
        {helper ? (
          <StatHelpText color="gray.500" mb={0} mt={1} fontSize="sm">
            {helper}
          </StatHelpText>
        ) : null}
      </Stat>
    </Box>
  )
}
