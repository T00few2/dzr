'use client'

import { useRef } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import type { PanelRole, RolePanel, TextChannel } from './types'
import { channelName, roleColorHex } from './types'

export default function PanelSection({
  panel,
  channels,
  onlyTeams,
  onEditPanel,
  onDeletePanel,
  onAddRole,
  onEditRole,
  onRemoveRole,
  onInlinePatch,
  onReorder,
}: {
  panel: RolePanel
  channels: TextChannel[]
  onlyTeams: boolean
  onEditPanel: () => void
  onDeletePanel: () => void
  onAddRole: () => void
  onEditRole: (role: PanelRole) => void
  onRemoveRole: (role: PanelRole) => void
  onInlinePatch: (roleId: string, field: string, value: any) => void
  onReorder: (roleOrder: string[]) => void
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dragFrom = useRef<string | null>(null)
  const chName = channelName(channels, panel.channelId)
  const roles = (panel.roles || []).filter((r) => (onlyTeams ? !!r.isTeamRole : true))

  function queue(roleId: string, field: string, value: any) {
    const key = `${roleId}:${field}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => {
      delete timers.current[key]
      onInlinePatch(roleId, field, value)
    }, 600)
  }

  function move(roleId: string, delta: number) {
    const ids = (panel.roles || []).map((r) => r.roleId)
    const i = ids.indexOf(roleId)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ids.length) return
    const next = [...ids]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    onReorder(next)
  }

  function onDrop(targetId: string) {
    const fromId = dragFrom.current
    dragFrom.current = null
    if (!fromId || fromId === targetId) return
    const ids = (panel.roles || []).map((r) => r.roleId)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, fromId)
    onReorder(next)
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
          <Text fontSize="xs" color="gray.400">{roles.length} roles</Text>
        </HStack>
        <HStack>
          <Button size="sm" variant="outline" colorScheme="red" onClick={onEditPanel}>Edit</Button>
          <Button size="sm" variant="outline" colorScheme="red" onClick={onDeletePanel}>Delete</Button>
          <Button size="sm" colorScheme="red" onClick={onAddRole}>Add Role</Button>
        </HStack>
      </Flex>
      <Box overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th color="gray.400">Order</Th>
              <Th color="gray.400">Role / Team</Th>
              <Th color="gray.400">Series</Th>
              <Th color="gray.400">Division</Th>
              <Th color="gray.400">Time</Th>
              <Th color="gray.400">LF</Th>
              <Th color="gray.400">Captain</Th>
              <Th color="gray.400">Prereqs</Th>
              <Th color="gray.400">Channel</Th>
              <Th color="gray.400">Vis</Th>
              <Th color="gray.400">Sort</Th>
              <Th color="gray.400">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {roles.length === 0 && (
              <Tr>
                <Td colSpan={12}>
                  <Text color="gray.500" py={4}>No roles in this panel.</Text>
                </Td>
              </Tr>
            )}
            {roles.map((role) => {
              const color = roleColorHex(role.roleColor)
              const label = role.teamName || role.roleName || role.roleId
              const captain = role.captainDisplayName || role.teamCaptainId || '—'
              return (
                <Tr
                  key={role.roleId}
                  draggable
                  onDragStart={() => { dragFrom.current = role.roleId }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(role.roleId)}
                >
                  <Td whiteSpace="nowrap">
                    <HStack spacing={1}>
                      <Text cursor="grab" color="gray.500" title="Drag to reorder">⋮⋮</Text>
                      <Button size="xs" variant="ghost" onClick={() => move(role.roleId, -1)}>↑</Button>
                      <Button size="xs" variant="ghost" onClick={() => move(role.roleId, 1)}>↓</Button>
                    </HStack>
                  </Td>
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
                    {!role.isTeamRole && (
                      <Text as="span" ml={2} fontSize="xs" color="gray.500">Non-team</Text>
                    )}
                    {role.roleExists === false && (
                      <Text as="span" ml={2} fontSize="xs" color="red.400">Missing in Discord</Text>
                    )}
                  </Td>
                  <Td>{role.raceSeries || '—'}</Td>
                  <Td>
                    <Input
                      size="sm"
                      defaultValue={role.division || ''}
                      bg="black"
                      onChange={(e) => queue(role.roleId, 'division', e.target.value)}
                    />
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      w="90px"
                      placeholder="HH:MM"
                      defaultValue={role.rideTime || ''}
                      bg="black"
                      onChange={(e) => queue(role.roleId, 'rideTime', e.target.value)}
                    />
                  </Td>
                  <Td textAlign="center">
                    <Checkbox
                      colorScheme="red"
                      defaultChecked={!!role.lookingForRiders}
                      onChange={(e) => queue(role.roleId, 'lookingForRiders', e.target.checked)}
                    />
                  </Td>
                  <Td>{captain}</Td>
                  <Td>{(role.requiredRoles || []).length}</Td>
                  <Td>#{chName}</Td>
                  <Td>
                    <Select
                      size="sm"
                      defaultValue={role.visibility || 'public'}
                      bg="black"
                      onChange={(e) => queue(role.roleId, 'visibility', e.target.value)}
                    >
                      <option value="public">public</option>
                      <option value="hidden">hidden</option>
                    </Select>
                  </Td>
                  <Td>
                    <Input
                      size="sm"
                      type="number"
                      w="70px"
                      defaultValue={Number.isFinite(Number(role.sortIndex)) ? Number(role.sortIndex) : 0}
                      bg="black"
                      onChange={(e) => queue(role.roleId, 'sortIndex', Number(e.target.value || 0))}
                    />
                  </Td>
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
