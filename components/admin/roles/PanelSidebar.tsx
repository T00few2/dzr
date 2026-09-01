'use client'

import {
  Box,
  Checkbox,
  Heading,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { RolePanel, TextChannel } from './types'
import { channelName } from './types'

export default function PanelSidebar({
  panels,
  channels,
  search,
  onSearch,
  onlyTeams,
  onOnlyTeams,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  panels: RolePanel[]
  channels: TextChannel[]
  search: string
  onSearch: (v: string) => void
  onlyTeams: boolean
  onOnlyTeams: (v: boolean) => void
  selectedIds: string[]
  onToggle: (panelId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
}) {
  const q = search.trim().toLowerCase()
  const filtered = panels.filter((p) => {
    if (!q) return true
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.panelId || '').toLowerCase().includes(q)
    )
  })
  const allSelected = panels.length > 0 && selectedIds.length === panels.length

  return (
    <Box
      w={{ base: '100%', md: '280px' }}
      flexShrink={0}
      bg="gray.900"
      border="1px solid"
      borderColor="whiteAlpha.200"
      rounded="md"
      p={4}
    >
      <Heading size="sm" mb={3}>Panels</Heading>
      <Text fontSize="xs" color="gray.400" mb={1}>Search panels</Text>
      <Input
        size="sm"
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        bg="black"
        mb={3}
      />
      <VStack align="stretch" spacing={2} mb={3}>
        <Checkbox isChecked={onlyTeams} onChange={(e) => onOnlyTeams(e.target.checked)} colorScheme="red">
          Show team roles only
        </Checkbox>
        <Checkbox isChecked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} colorScheme="red">
          Select all
        </Checkbox>
      </VStack>
      <VStack align="stretch" spacing={2} maxH="70vh" overflowY="auto">
        {filtered.map((p) => (
          <Checkbox
            key={p.panelId}
            isChecked={selectedIds.includes(p.panelId)}
            onChange={(e) => onToggle(p.panelId, e.target.checked)}
            colorScheme="red"
            alignItems="flex-start"
          >
            <Box>
              <Text fontSize="sm">{p.name || p.panelId}</Text>
              <Text fontSize="xs" color="gray.500">
                #{channelName(channels, p.channelId)} · {(p.roles || []).length}
              </Text>
            </Box>
          </Checkbox>
        ))}
      </VStack>
    </Box>
  )
}
