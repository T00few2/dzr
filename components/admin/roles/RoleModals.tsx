'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import type { GuildRole, PanelRole, RolePanel, TextChannel } from './types'
import { BUTTON_COLOR_OPTIONS, RACE_SERIES } from './types'

const inputBg = { bg: 'black' }

function RoleChecklist({
  roles,
  selected,
  onChange,
}: {
  roles: GuildRole[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string, checked: boolean) {
    if (checked) onChange(Array.from(new Set([...selected, id])))
    else onChange(selected.filter((x) => x !== id))
  }
  return (
    <Box maxH="140px" overflowY="auto" border="1px solid" borderColor="whiteAlpha.300" rounded="md" p={2}>
      {roles.map((r) => (
        <Checkbox
          key={r.id}
          isChecked={selected.includes(r.id)}
          onChange={(e) => toggle(r.id, e.target.checked)}
          colorScheme="red"
          display="block"
          mb={1}
        >
          <Text fontSize="sm">{r.name}</Text>
        </Checkbox>
      ))}
    </Box>
  )
}

function ChannelSelect({
  channels,
  value,
  onChange,
  placeholder,
  includeEmptyLabel,
}: {
  channels: TextChannel[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  includeEmptyLabel?: string
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...inputBg}>
      <option value="">{includeEmptyLabel || placeholder || 'Select a channel...'}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>#{c.name}</option>
      ))}
    </Select>
  )
}

export function PanelModal({
  mode,
  isOpen,
  onClose,
  channels,
  roles,
  initial,
  submitting,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  isOpen: boolean
  onClose: () => void
  channels: TextChannel[]
  roles: GuildRole[]
  initial?: Partial<RolePanel> | null
  submitting: boolean
  onSubmit: (data: {
    panelId?: string
    name: string
    description: string
    footerText: string
    channelId: string
    requiredRoles: string[]
    approvalChannelId: string
  }) => void
}) {
  const [panelId, setPanelId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [footerText, setFooterText] = useState('')
  const [channelId, setChannelId] = useState('')
  const [requiredRoles, setRequiredRoles] = useState<string[]>([])
  const [approvalChannelId, setApprovalChannelId] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setPanelId(initial?.panelId || '')
    setName(initial?.name || '')
    setDescription(initial?.description || '')
    setFooterText(initial?.footerText || '')
    setChannelId(initial?.channelId || '')
    setRequiredRoles(initial?.requiredRoles || [])
    setApprovalChannelId(initial?.approvalChannelId || '')
  }, [isOpen, initial])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white">
        <ModalHeader>{mode === 'create' ? 'Create New Role Panel' : 'Edit Role Panel'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {mode === 'create' && (
              <FormControl isRequired>
                <FormLabel>Panel ID</FormLabel>
                <Input value={panelId} onChange={(e) => setPanelId(e.target.value.trim().toLowerCase())} {...inputBg} />
                <FormHelperText>Unique identifier (lowercase, no spaces)</FormHelperText>
              </FormControl>
            )}
            <FormControl isRequired>
              <FormLabel>Panel Name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} {...inputBg} />
            </FormControl>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Click the buttons below to add or remove roles!"
                {...inputBg}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Footer Text</FormLabel>
              <Textarea
                rows={3}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Optional text displayed after the role list"
                {...inputBg}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Channel</FormLabel>
              <ChannelSelect channels={channels} value={channelId} onChange={setChannelId} />
              <FormHelperText>Channel where this role panel will be displayed</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Required Roles</FormLabel>
              <RoleChecklist roles={roles} selected={requiredRoles} onChange={setRequiredRoles} />
              <FormHelperText>Users must have one of these roles to access this panel</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Approval Channel</FormLabel>
              <ChannelSelect
                channels={channels}
                value={approvalChannelId}
                onChange={setApprovalChannelId}
                includeEmptyLabel="No approval required"
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
            colorScheme="red"
            isLoading={submitting}
            isDisabled={!name.trim() || !channelId || (mode === 'create' && !panelId)}
            onClick={() => onSubmit({
              panelId,
              name: name.trim(),
              description,
              footerText,
              channelId,
              requiredRoles,
              approvalChannelId,
            })}
          >
            {mode === 'create' ? 'Create Panel' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export type RoleFormData = {
  roleId: string
  roleName: string
  description: string
  emoji: string
  buttonColor: string
  requiredRoles: string[]
  requiresApproval: boolean
  teamCaptainId: string
  roleApprovalChannelId: string
  isTeamRole: boolean
  teamName: string
  raceSeries: string
  division: string
  rideTime: string
  lookingForRiders: boolean
  sortIndex: number
  visibility: string
  captainDisplayName: string
}

export function RoleModal({
  mode,
  isOpen,
  onClose,
  channels,
  roles,
  usedRoleIds,
  initial,
  submitting,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  isOpen: boolean
  onClose: () => void
  channels: TextChannel[]
  roles: GuildRole[]
  usedRoleIds: string[]
  initial?: PanelRole | null
  submitting: boolean
  onSubmit: (data: RoleFormData) => void
}) {
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [buttonColor, setButtonColor] = useState('Secondary')
  const [requiredRoles, setRequiredRoles] = useState<string[]>([])
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [teamCaptainId, setTeamCaptainId] = useState('')
  const [roleApprovalChannelId, setRoleApprovalChannelId] = useState('')
  const [isTeamRole, setIsTeamRole] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [raceSeries, setRaceSeries] = useState('')
  const [division, setDivision] = useState('')
  const [rideTime, setRideTime] = useState('')
  const [lookingForRiders, setLookingForRiders] = useState(false)
  const [sortIndex, setSortIndex] = useState(0)
  const [visibility, setVisibility] = useState('public')
  const [captainDisplayName, setCaptainDisplayName] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setRoleId(initial?.roleId || '')
    setRoleName(initial?.roleName || '')
    setDescription(initial?.description || '')
    setEmoji(initial?.emoji || '')
    setButtonColor(initial?.buttonColor || 'Secondary')
    setRequiredRoles(initial?.requiredRoles || [])
    setRequiresApproval(!!initial?.requiresApproval)
    setTeamCaptainId(initial?.teamCaptainId || '')
    setRoleApprovalChannelId(initial?.roleApprovalChannelId || '')
    setIsTeamRole(!!initial?.isTeamRole)
    setTeamName(initial?.teamName || '')
    setRaceSeries(initial?.raceSeries || '')
    setDivision(initial?.division || '')
    setRideTime(initial?.rideTime || '')
    setLookingForRiders(!!initial?.lookingForRiders)
    setSortIndex(Number(initial?.sortIndex || 0))
    setVisibility(initial?.visibility || 'public')
    setCaptainDisplayName(initial?.captainDisplayName || '')
  }, [isOpen, initial])

  const available = roles.filter((r) => r.id === roleId || !usedRoleIds.includes(r.id))

  function collect(): RoleFormData {
    return {
      roleId,
      roleName,
      description,
      emoji,
      buttonColor,
      requiredRoles,
      requiresApproval,
      teamCaptainId,
      roleApprovalChannelId,
      isTeamRole,
      teamName,
      raceSeries,
      division,
      rideTime,
      lookingForRiders,
      sortIndex,
      visibility,
      captainDisplayName,
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white">
        <ModalHeader>{mode === 'add' ? 'Add Role to Panel' : 'Edit Role'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {mode === 'add' ? (
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select
                  value={roleId}
                  onChange={(e) => {
                    const id = e.target.value
                    setRoleId(id)
                    setRoleName(roles.find((r) => r.id === id)?.name || '')
                  }}
                  {...inputBg}
                >
                  <option value="">Select a role...</option>
                  {available.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl>
                <FormLabel>Role Name</FormLabel>
                <Input value={roleName} isReadOnly {...inputBg} />
                <FormHelperText>Role name cannot be changed (managed by Discord)</FormHelperText>
              </FormControl>
            )}
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} {...inputBg} />
            </FormControl>
            <FormControl>
              <FormLabel>Emoji</FormLabel>
              <Input value={emoji} maxLength={10} onChange={(e) => setEmoji(e.target.value)} placeholder="🔹" {...inputBg} />
            </FormControl>
            <FormControl>
              <FormLabel>Button Color</FormLabel>
              <Select value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} {...inputBg}>
                {BUTTON_COLOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Required Roles (Prerequisites)</FormLabel>
              <RoleChecklist roles={roles} selected={requiredRoles} onChange={setRequiredRoles} />
              <FormHelperText>Users must have these roles before they can get this role</FormHelperText>
            </FormControl>
            <FormControl>
              <Checkbox isChecked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} colorScheme="red">
                Requires Approval
              </Checkbox>
            </FormControl>
            {requiresApproval && (
              <>
                <FormControl>
                  <FormLabel>Team Captain</FormLabel>
                  <Input
                    value={teamCaptainId}
                    onChange={(e) => setTeamCaptainId(e.target.value)}
                    placeholder="User ID of team captain"
                    {...inputBg}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Role-Specific Approval Channel</FormLabel>
                  <ChannelSelect
                    channels={channels}
                    value={roleApprovalChannelId}
                    onChange={setRoleApprovalChannelId}
                    includeEmptyLabel="Use panel default"
                  />
                </FormControl>
              </>
            )}
            <FormControl>
              <Checkbox isChecked={isTeamRole} onChange={(e) => setIsTeamRole(e.target.checked)} colorScheme="red">
                Is Team Role
              </Checkbox>
              <FormHelperText>Enable to add team metadata used on the website</FormHelperText>
            </FormControl>
            {isTeamRole && (
              <>
                <FormControl>
                  <FormLabel>Team Name</FormLabel>
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g., DZR A1" {...inputBg} />
                </FormControl>
                <FormControl>
                  <FormLabel>Race Series</FormLabel>
                  <Select value={raceSeries} onChange={(e) => setRaceSeries(e.target.value)} {...inputBg}>
                    <option value="">Select series...</option>
                    {RACE_SERIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Division</FormLabel>
                  <Input value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g., A1 / Doppio / Diamond" {...inputBg} />
                </FormControl>
                <FormControl>
                  <FormLabel>Ride Time (HH:MM)</FormLabel>
                  <Input value={rideTime} onChange={(e) => setRideTime(e.target.value)} placeholder="19:30" {...inputBg} />
                </FormControl>
                <FormControl>
                  <Checkbox isChecked={lookingForRiders} onChange={(e) => setLookingForRiders(e.target.checked)} colorScheme="red">
                    Looking for riders
                  </Checkbox>
                </FormControl>
                <FormControl>
                  <FormLabel>Sort Index</FormLabel>
                  <Input type="number" value={sortIndex} onChange={(e) => setSortIndex(Number(e.target.value || 0))} {...inputBg} />
                </FormControl>
                <FormControl>
                  <FormLabel>Visibility</FormLabel>
                  <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} {...inputBg}>
                    <option value="public">Public</option>
                    <option value="hidden">Hidden</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Captain Display Name (optional)</FormLabel>
                  <Input
                    value={captainDisplayName}
                    onChange={(e) => setCaptainDisplayName(e.target.value)}
                    placeholder="Shown on website"
                    {...inputBg}
                  />
                </FormControl>
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
            colorScheme="red"
            isLoading={submitting}
            isDisabled={mode === 'add' && !roleId}
            onClick={() => onSubmit(collect())}
          >
            {mode === 'add' ? 'Add Role' : 'Update Role'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
