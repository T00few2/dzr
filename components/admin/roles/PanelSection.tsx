'use client'

import { useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react'
import { MdDragIndicator } from 'react-icons/md'
import type { PanelRole, RolePanel, TextChannel } from './types'
import { channelName, roleColorHex } from './types'

export default function PanelSection({
  panel,
  channels,
  showAdvanced,
  onEditPanel,
  onDeletePanel,
  onAddRole,
  onEditRole,
  onRemoveRole,
  onReorder,
}: {
  panel: RolePanel
  channels: TextChannel[]
  showAdvanced?: boolean
  onEditPanel: () => void
  onDeletePanel: () => void
  onAddRole: () => void
  onEditRole: (role: PanelRole) => void
  onRemoveRole: (role: PanelRole) => void
  onReorder?: (roleIds: string[]) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const chName = channelName(channels, panel.channelId)
  const isTeamPanel = Boolean(panel.provisioning?.createVoice)
  const addLabel = isTeamPanel ? 'Add team' : 'Add series'
  const roles = panel.roles || []
  const countLabel = isTeamPanel
    ? `${roles.length} team${roles.length === 1 ? '' : 's'}`
    : `${roles.length} series`
  const missingCategories = !panel.provisioning?.textCategoryId
    || (isTeamPanel && !panel.provisioning?.voiceCategoryId)
  const canDrag = Boolean(showAdvanced && onReorder)
  const colSpan = canDrag ? 8 : 7

  function moveRole(fromId: string, toId: string) {
    if (!onReorder || fromId === toId) return
    const from = roles.findIndex((r) => r.roleId === fromId)
    const to = roles.findIndex((r) => r.roleId === toId)
    if (from < 0 || to < 0) return
    const next = [...roles]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onReorder(next.map((r) => r.roleId))
  }

  return (
    <Box border="1px solid" borderColor="whiteAlpha.200" rounded="md" bg="gray.900" mb={4} overflow="hidden">
      <Flex
        px={4}
        py={3}
        gap={3}
        wrap="wrap"
        align="center"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="whiteAlpha.200"
      >
        <HStack spacing={3} wrap="wrap">
          <Heading size="sm">{panel.name || panel.panelId}</Heading>
          <Text fontSize="xs" color="gray.400" bg="black" px={2} py={0.5} rounded="sm">#{chName}</Text>
          <Text fontSize="xs" color="gray.400">{countLabel}</Text>
          {canDrag && (
            <Text fontSize="xs" color="gray.500">Drag rows to reorder</Text>
          )}
        </HStack>
        <HStack>
          {showAdvanced && (
            <>
              <Button size="sm" variant="outline" colorScheme="red" onClick={onEditPanel}>Edit Panel</Button>
              <Button size="sm" variant="outline" colorScheme="red" onClick={onDeletePanel}>Delete panel</Button>
            </>
          )}
          <Button size="sm" colorScheme="red" onClick={onAddRole}>{addLabel}</Button>
        </HStack>
      </Flex>
      {missingCategories && (
        <Alert status="warning" bg="black" color="white" rounded="none" borderBottom="1px solid" borderColor="whiteAlpha.200">
          <AlertIcon />
          Set Discord categories in Edit Panel before others can add teams.
        </Alert>
      )}
      <Box overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              {canDrag && <Th color="gray.400" w="36px" px={1} />}
              <Th color="gray.400">Role / team</Th>
              <Th color="gray.400">Series</Th>
              <Th color="gray.400">Division</Th>
              <Th color="gray.400">Time</Th>
              <Th color="gray.400">
                <Tooltip label="Looking for riders" placement="top" hasArrow>
                  <Text as="span" cursor="help" borderBottom="1px dotted" borderColor="gray.500">LfR</Text>
                </Tooltip>
              </Th>
              <Th color="gray.400">Captain</Th>
              <Th color="gray.400">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {roles.length === 0 && (
              <Tr>
                <Td colSpan={colSpan}>
                  <Text color="gray.500" py={4}>No {isTeamPanel ? 'teams' : 'series'} in this panel.</Text>
                </Td>
              </Tr>
            )}
            {roles.map((role) => {
              const color = roleColorHex(role.roleColor)
              const label = role.teamName || role.roleName || role.roleId
              const captain = role.captainDisplayName || '—'
              const isDragging = dragId === role.roleId
              const isOver = overId === role.roleId && dragId && dragId !== role.roleId
              return (
                <Tr
                  key={role.roleId}
                  opacity={isDragging ? 0.45 : 1}
                  bg={isOver ? 'whiteAlpha.200' : undefined}
                  onDragOver={canDrag ? (e) => {
                    e.preventDefault()
                    if (overId !== role.roleId) setOverId(role.roleId)
                  } : undefined}
                  onDrop={canDrag ? (e) => {
                    e.preventDefault()
                    const fromId = e.dataTransfer.getData('text/plain') || dragId
                    if (fromId) moveRole(fromId, role.roleId)
                    setDragId(null)
                    setOverId(null)
                  } : undefined}
                  onDragLeave={canDrag ? () => {
                    if (overId === role.roleId) setOverId(null)
                  } : undefined}
                >
                  {canDrag && (
                    <Td
                      px={1}
                      cursor="grab"
                      draggable
                      userSelect="none"
                      onDragStart={(e) => {
                        setDragId(role.roleId)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', role.roleId)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverId(null)
                      }}
                      title="Drag to reorder"
                    >
                      <Icon as={MdDragIndicator} boxSize={5} color="gray.400" />
                    </Td>
                  )}
                  <Td>
                    <Box
                      as="span"
                      display="inline-block"
                      px={2}
                      py={0.5}
                      rounded="sm"
                      bg={color}
                      color="white"
                      fontSize="xs"
                      fontWeight="semibold"
                    >
                      {role.emoji ? `${role.emoji} ` : ''}{label}
                    </Box>
                    {role.roleExists === false && (
                      <Text as="span" ml={2} fontSize="xs" color="red.400">Missing in Discord</Text>
                    )}
                  </Td>
                  <Td>{role.raceSeries || '—'}</Td>
                  <Td>{role.division || '—'}</Td>
                  <Td>{role.rideTime || '—'}</Td>
                  <Td>{role.lookingForRiders ? 'Yes' : 'No'}</Td>
                  <Td>{captain}</Td>
                  <Td>
                    <HStack>
                      <Button size="xs" variant="outline" colorScheme="red" onClick={() => onEditRole(role)}>Edit</Button>
                      <Button size="xs" variant="ghost" colorScheme="red" onClick={() => onRemoveRole(role)}>Remove</Button>
                    </HStack>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </Box>
    </Box>
  )
}
