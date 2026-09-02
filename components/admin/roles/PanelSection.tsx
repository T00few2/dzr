'use client'

import { useRef } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
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
  showAdvanced,
  onEditPanel,
  onDeletePanel,
  onAddRole,
  onEditRole,
  onRemoveRole,
  onInlinePatch,
}: {
  panel: RolePanel
  channels: TextChannel[]
  onlyTeams: boolean
  showAdvanced?: boolean
  onEditPanel: () => void
  onDeletePanel: () => void
  onAddRole: () => void
  onEditRole: (role: PanelRole) => void
  onRemoveRole: (role: PanelRole) => void
  onInlinePatch: (roleId: string, field: string, value: any) => void
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const chName = channelName(channels, panel.channelId)
  const isTeamPanel = Boolean(panel.provisioning?.createVoice)
  const addLabel = isTeamPanel ? 'Add team' : 'Add series'
  const roles = (panel.roles || []).filter((r) => (onlyTeams ? !!r.isTeamRole : true))
  const countLabel = isTeamPanel
    ? `${roles.length} team${roles.length === 1 ? '' : 's'}`
    : `${roles.length} series`
  const missingCategories = !panel.provisioning?.textCategoryId
    || (isTeamPanel && !panel.provisioning?.voiceCategoryId)

  function queue(roleId: string, field: string, value: any) {
    const key = `${roleId}:${field}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => {
      delete timers.current[key]
      onInlinePatch(roleId, field, value)
    }, 600)
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
        </HStack>
        <HStack>
          <Button size="sm" variant="outline" colorScheme="red" onClick={onEditPanel}>Edit Panel</Button>
          {showAdvanced && (
            <Button size="sm" variant="outline" colorScheme="red" onClick={onDeletePanel}>Delete panel</Button>
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
              <Th color="gray.400">Role / team</Th>
              <Th color="gray.400">Series</Th>
              <Th color="gray.400">Division</Th>
              <Th color="gray.400">Time</Th>
              <Th color="gray.400">LF</Th>
              <Th color="gray.400">Captain</Th>
              <Th color="gray.400">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {roles.length === 0 && (
              <Tr>
                <Td colSpan={7}>
                  <Text color="gray.500" py={4}>No {isTeamPanel ? 'teams' : 'series'} in this panel.</Text>
                </Td>
              </Tr>
            )}
            {roles.map((role) => {
              const color = roleColorHex(role.roleColor)
              const label = role.teamName || role.roleName || role.roleId
              const captain = role.captainDisplayName || '—'
              return (
                <Tr key={role.roleId}>
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
