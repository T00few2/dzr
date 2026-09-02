'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import type { CategoryChannel, GuildRole, PanelRole, RolePanel, TextChannel } from './types'
import { BUTTON_COLOR_OPTIONS, RACE_SERIES, channelName, hexFromRoleColor, parseRoleColor } from './types'

const inputBg = { bg: 'black', color: 'white' }
const selectProps = {
  bg: 'black',
  color: 'white',
  sx: {
    option: {
      color: '#171923',
      bg: 'white',
    },
  },
}

function teamDescriptionFrom(series: string, division: string) {
  const s = String(series || '').trim()
  const d = String(division || '').trim()
  if (s && d) return `${s} (${d})`
  return s
}

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
  prefix = '#',
}: {
  channels: { id: string; name: string }[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  includeEmptyLabel?: string
  prefix?: string
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...selectProps}>
      <option value="">{includeEmptyLabel || placeholder || 'Select a channel...'}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>{prefix}{c.name}</option>
      ))}
    </Select>
  )
}

function RoleColorField({
  value,
  onChange,
  helper,
}: {
  value: string
  onChange: (hex: string) => void
  helper?: string
}) {
  const picker = /^#[0-9a-fA-F]{6}$/i.test(value) ? value : '#5865F2'
  return (
    <FormControl>
      <FormLabel>Role color</FormLabel>
      <HStack>
        <Input
          type="color"
          value={picker}
          onChange={(e) => onChange(e.target.value)}
          w="56px"
          p={1}
          minW="56px"
          {...inputBg}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#5865F2"
          {...inputBg}
        />
      </HStack>
      {helper ? <FormHelperText>{helper}</FormHelperText> : null}
    </FormControl>
  )
}

type GuildMemberOption = {
  discordID: string
  displayName: string
  username: string
  bot?: boolean
}

function CaptainPicker({
  members,
  loading,
  valueId,
  fallbackLabel,
  onSelect,
}: {
  members: GuildMemberOption[]
  loading: boolean
  valueId: string
  fallbackLabel?: string
  onSelect: (m: GuildMemberOption) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = members.find((m) => m.discordID === valueId)
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const list = !q
      ? members
      : members.filter((m) => (
        m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
      ))
    return list.slice(0, 25)
  }, [members, q])
  const closedLabel = selected?.displayName || fallbackLabel || ''

  return (
    <Box position="relative">
      <Input
        value={open ? query : closedLabel}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search Discord members..."
        {...inputBg}
      />
      {selected && !open && (
        <Text fontSize="xs" color="gray.400" mt={1}>@{selected.username}</Text>
      )}
      {open && (
        <Box
          position="absolute"
          zIndex={20}
          w="100%"
          maxH="220px"
          overflowY="auto"
          bg="gray.800"
          border="1px solid"
          borderColor="whiteAlpha.300"
          rounded="md"
          mt={1}
        >
          {loading && <Text p={2} fontSize="sm" color="gray.400">Loading members...</Text>}
          {!loading && filtered.length === 0 && (
            <Text p={2} fontSize="sm" color="gray.400">No matches</Text>
          )}
          {!loading && filtered.map((m) => (
            <Box
              key={m.discordID}
              px={3}
              py={2}
              cursor="pointer"
              _hover={{ bg: 'whiteAlpha.200' }}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(m)
                setQuery('')
                setOpen(false)
              }}
            >
              <Text fontSize="sm">{m.displayName}</Text>
              <Text fontSize="xs" color="gray.400">@{m.username}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

export function PanelModal({
  mode,
  isOpen,
  onClose,
  channels,
  categories,
  roles,
  initial,
  submitting,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  isOpen: boolean
  onClose: () => void
  channels: TextChannel[]
  categories: CategoryChannel[]
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
    provisioning: {
      createVoice: boolean
      textCategoryId: string
      voiceCategoryId: string
      extraViewerRoleIds: string[]
      roleColor?: number | null
    }
  }) => void
}) {
  const [panelId, setPanelId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [footerText, setFooterText] = useState('')
  const [channelId, setChannelId] = useState('')
  const [requiredRoles, setRequiredRoles] = useState<string[]>([])
  const [approvalChannelId, setApprovalChannelId] = useState('')
  const [createVoice, setCreateVoice] = useState(false)
  const [textCategoryId, setTextCategoryId] = useState('')
  const [voiceCategoryId, setVoiceCategoryId] = useState('')
  const [defaultRoleColorHex, setDefaultRoleColorHex] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setPanelId(initial?.panelId || '')
    setName(initial?.name || '')
    setDescription(initial?.description || '')
    setFooterText(initial?.footerText || '')
    setChannelId(initial?.channelId || '')
    setRequiredRoles(initial?.requiredRoles || [])
    setApprovalChannelId(initial?.approvalChannelId || '')
    setCreateVoice(!!initial?.provisioning?.createVoice)
    setTextCategoryId(initial?.provisioning?.textCategoryId || '')
    setVoiceCategoryId(initial?.provisioning?.voiceCategoryId || '')
    setDefaultRoleColorHex(hexFromRoleColor(initial?.provisioning?.roleColor))
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
            <FormControl>
              <FormLabel>New-role text category</FormLabel>
              <ChannelSelect
                channels={categories}
                value={textCategoryId}
                onChange={setTextCategoryId}
                includeEmptyLabel="Not configured"
                prefix=""
              />
              <FormHelperText>Private text channels for newly created roles are placed here</FormHelperText>
            </FormControl>
            <FormControl>
              <Checkbox isChecked={createVoice} onChange={(e) => setCreateVoice(e.target.checked)} colorScheme="red">
                Also create a private voice channel (Hold)
              </Checkbox>
            </FormControl>
            {createVoice && (
              <FormControl>
                <FormLabel>New-role voice category</FormLabel>
                <ChannelSelect
                  channels={categories}
                  value={voiceCategoryId}
                  onChange={setVoiceCategoryId}
                  includeEmptyLabel="Same as text category"
                  prefix=""
                />
              </FormControl>
            )}
            <RoleColorField
              value={defaultRoleColorHex}
              onChange={setDefaultRoleColorHex}
              helper="Used for every new Discord role created in this panel. You can still change it on Create team / Create series."
            />
            <Text fontSize="sm" color="gray.400">
              New channels are private and unsynced. Access is Admin, DZR Bot, and the created team role (same as Zephyrus Zwifters). Member and Holdkaptajn are not copied from the category.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }} mr={3} onClick={onClose}>Cancel</Button>
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
              provisioning: {
                createVoice,
                textCategoryId,
                voiceCategoryId,
                extraViewerRoleIds: initial?.provisioning?.extraViewerRoleIds || [],
                roleColor: parseRoleColor(defaultRoleColorHex) || null,
              },
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
  createDiscord: boolean
  roleId: string
  roleName: string
  roleColor?: number
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
  textChannelId: string
  voiceChannelId: string
  textCategoryId?: string
  voiceCategoryId?: string
  redeploy?: boolean
}

export function RoleModal({
  mode,
  isOpen,
  onClose,
  channels,
  voiceChannels,
  categories,
  roles,
  usedRoleIds,
  panel,
  initial,
  submitting,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  isOpen: boolean
  onClose: () => void
  channels: TextChannel[]
  voiceChannels: TextChannel[]
  categories: CategoryChannel[]
  roles: GuildRole[]
  usedRoleIds: string[]
  panel?: RolePanel | null
  initial?: PanelRole | null
  submitting: boolean
  onSubmit: (data: RoleFormData) => void
}) {
  const [createDiscord, setCreateDiscord] = useState(false)
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [roleColorHex, setRoleColorHex] = useState('')
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
  const [textChannelId, setTextChannelId] = useState('')
  const [voiceChannelId, setVoiceChannelId] = useState('')
  const [textCategoryId, setTextCategoryId] = useState('')
  const [voiceCategoryId, setVoiceCategoryId] = useState('')
  const [members, setMembers] = useState<GuildMemberOption[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const lastAutoDescription = useRef('')

  const canCreate = Boolean(panel?.provisioning?.textCategoryId)
  const createVoice = Boolean(panel?.provisioning?.createVoice)
  const isTeamPanel = createVoice

  useEffect(() => {
    if (!isOpen) return
    setCreateDiscord(false)
    setRoleId(initial?.roleId || '')
    setRoleName(initial?.roleName || '')
    setRoleColorHex(mode === 'add'
      ? hexFromRoleColor(panel?.provisioning?.roleColor)
      : hexFromRoleColor(initial?.roleColor))
    setDescription(initial?.description || '')
    lastAutoDescription.current = teamDescriptionFrom(initial?.raceSeries || '', initial?.division || '')
    setEmoji(initial?.emoji || '')
    setButtonColor(initial?.buttonColor || 'Secondary')
    setRequiredRoles(initial?.requiredRoles || [])
    setRequiresApproval(!!initial?.requiresApproval)
    setTeamCaptainId(initial?.teamCaptainId || '')
    setRoleApprovalChannelId(initial?.roleApprovalChannelId || '')
    setIsTeamRole(!!initial?.isTeamRole)
    setTeamName(initial?.teamName || (panel?.provisioning?.createVoice ? (initial?.roleName || '') : ''))
    setRaceSeries(initial?.raceSeries || '')
    setDivision(initial?.division || '')
    setRideTime(initial?.rideTime || '')
    setLookingForRiders(!!initial?.lookingForRiders)
    setSortIndex(Number(initial?.sortIndex || 0))
    setVisibility(initial?.visibility || 'public')
    setCaptainDisplayName(initial?.captainDisplayName || '')
    setTextChannelId(initial?.textChannelId || '')
    setVoiceChannelId(initial?.voiceChannelId || '')
    setTextCategoryId(panel?.provisioning?.textCategoryId || '')
    setVoiceCategoryId(panel?.provisioning?.voiceCategoryId || '')
    if (mode === 'add') {
      setCreateDiscord(Boolean(panel?.provisioning?.textCategoryId))
      if (panel?.provisioning?.createVoice) {
        setIsTeamRole(true)
        setRequiresApproval(true)
        setButtonColor('Primary')
      } else {
        setIsTeamRole(false)
        setRequiresApproval(false)
        setButtonColor('Danger')
      }
    }
  }, [isOpen, initial, mode, panel])

  useEffect(() => {
    if (!isOpen || !isTeamPanel) return
    let cancelled = false
    setMembersLoading(true)
    fetch('/api/admin/members')
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        const list = ((body.members || []) as GuildMemberOption[]).filter((m) => m.discordID && !m.bot)
        setMembers(list)
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen, isTeamPanel])

  const available = roles.filter((r) => r.id === roleId || !usedRoleIds.includes(r.id))

  function applyCreateDefaults(nextCreate: boolean) {
    setCreateDiscord(nextCreate)
    if (!nextCreate) return
    if (createVoice) {
      setIsTeamRole(true)
      setRequiresApproval(true)
      setButtonColor('Primary')
    } else {
      setIsTeamRole(false)
      setRequiresApproval(false)
      setButtonColor('Danger')
    }
    if (mode === 'add' && teamName.trim()) setRoleName(teamName.trim())
  }

  function setHoldName(value: string) {
    setTeamName(value)
    if (mode === 'add' && createDiscord) setRoleName(value)
  }

  function applyTeamDescription(nextSeries: string, nextDivision: string) {
    const next = teamDescriptionFrom(nextSeries, nextDivision)
    setDescription((prev) => {
      if (!prev.trim() || prev === lastAutoDescription.current) {
        lastAutoDescription.current = next
        return next
      }
      return prev
    })
  }

  function collect(): RoleFormData {
    const autoDescription = teamDescriptionFrom(raceSeries, division)
    return {
      createDiscord: mode === 'add' && createDiscord,
      roleId,
      roleName,
      roleColor: parseRoleColor(roleColorHex),
      description: isTeamPanel ? (description.trim() || autoDescription) : description,
      emoji,
      buttonColor,
      requiredRoles,
      requiresApproval,
      teamCaptainId,
      roleApprovalChannelId,
      isTeamRole,
      teamName: isTeamPanel ? (teamName || roleName) : teamName,
      raceSeries,
      division,
      rideTime,
      lookingForRiders,
      sortIndex,
      visibility,
      captainDisplayName,
      textChannelId,
      voiceChannelId,
      textCategoryId,
      voiceCategoryId,
      redeploy: mode === 'edit',
    }
  }

  const addDisabled = createDiscord
    ? !roleName.trim() || !canCreate || (createVoice && !voiceCategoryId)
    : !roleId

  const title = mode === 'add'
    ? (isTeamPanel ? 'Add team' : 'Add series')
    : (isTeamPanel ? 'Edit team' : 'Edit series')

  const primaryLabel = mode === 'add'
    ? (createDiscord
      ? (isTeamPanel ? 'Create team' : 'Create series')
      : (isTeamPanel ? 'Add team' : 'Add series'))
    : (isTeamPanel ? 'Update team' : 'Update series')

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {mode === 'add' && createDiscord && !canCreate && (
              <Alert status="warning" bg="black" color="white" rounded="md">
                <AlertIcon />
                Set Discord categories in Edit Panel before others can add teams.
              </Alert>
            )}

            {isTeamPanel ? (
              <>
                <FormControl isRequired={mode === 'add' && createDiscord}>
                  <FormLabel>Team name</FormLabel>
                  {mode === 'edit' ? (
                    <Input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Aero Albatrosses"
                      {...inputBg}
                    />
                  ) : (
                    <Input
                      value={createDiscord ? roleName : teamName}
                      onChange={(e) => setHoldName(e.target.value)}
                      placeholder="e.g. Aero Albatrosses"
                      {...inputBg}
                    />
                  )}
                  {mode === 'add' && (
                    <FormHelperText>
                      Creates a Discord role plus private text and voice channels.
                    </FormHelperText>
                  )}
                </FormControl>
                <FormControl>
                  <FormLabel>Race series</FormLabel>
                  <Select
                    value={raceSeries}
                    onChange={(e) => {
                      const next = e.target.value
                      setRaceSeries(next)
                      applyTeamDescription(next, division)
                    }}
                    {...selectProps}
                  >
                    <option value="">Select series...</option>
                    {RACE_SERIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Division</FormLabel>
                  <Input
                    value={division}
                    onChange={(e) => {
                      const next = e.target.value
                      setDivision(next)
                      applyTeamDescription(raceSeries, next)
                    }}
                    placeholder="e.g., A1 / Doppio / Diamond"
                    {...inputBg}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Ride time (HH:MM)</FormLabel>
                  <Input value={rideTime} onChange={(e) => setRideTime(e.target.value)} placeholder="19:30" {...inputBg} />
                </FormControl>
                <FormControl>
                  <FormLabel>Captain</FormLabel>
                  <CaptainPicker
                    key={isOpen ? (initial?.roleId || 'add') : 'closed'}
                    members={members}
                    loading={membersLoading}
                    valueId={teamCaptainId}
                    fallbackLabel={captainDisplayName}
                    onSelect={(m) => {
                      setTeamCaptainId(m.discordID)
                      setCaptainDisplayName(m.displayName)
                    }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Captain display name</FormLabel>
                  <Input
                    value={captainDisplayName}
                    onChange={(e) => setCaptainDisplayName(e.target.value)}
                    placeholder="Shown on the website"
                    {...inputBg}
                  />
                  <FormHelperText>Filled from Discord; you can shorten or override it.</FormHelperText>
                </FormControl>
                <FormControl>
                  <Checkbox isChecked={lookingForRiders} onChange={(e) => setLookingForRiders(e.target.checked)} colorScheme="red">
                    Looking for riders
                  </Checkbox>
                </FormControl>
              </>
            ) : (
              <>
                <FormControl isRequired={mode === 'add' && createDiscord}>
                  <FormLabel>Name</FormLabel>
                  {mode === 'edit' ? (
                    <Input value={roleName} isReadOnly {...inputBg} />
                  ) : (
                    <Input
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g. Club Ladder"
                      {...inputBg}
                    />
                  )}
                  <FormHelperText>
                    {mode === 'edit'
                      ? 'Role name cannot be changed (managed by Discord)'
                      : 'Creates a Discord role plus a private text channel.'}
                  </FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>Description (optional)</FormLabel>
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} {...inputBg} />
                </FormControl>
              </>
            )}

            <Accordion allowToggle>
              <AccordionItem border="1px solid" borderColor="whiteAlpha.200" rounded="md">
                <AccordionButton>
                  <Box flex="1" textAlign="left" fontWeight="semibold">Advanced</Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <VStack spacing={4} align="stretch">
                    {mode === 'add' ? (
                      <>
                        <FormControl>
                          <FormLabel>Discord</FormLabel>
                          <RadioGroup
                            value={createDiscord ? 'create' : 'link'}
                            onChange={(v) => applyCreateDefaults(v === 'create')}
                          >
                            <Stack>
                              <Radio value="create" colorScheme="red" isDisabled={!canCreate}>
                                Create in Discord
                              </Radio>
                              <Radio value="link" colorScheme="red">Link existing role</Radio>
                            </Stack>
                          </RadioGroup>
                          {!canCreate && (
                            <Alert status="warning" mt={2} bg="black" color="white" rounded="md">
                              <AlertIcon />
                              Set Discord categories in Edit Panel before creating Discord roles and channels.
                            </Alert>
                          )}
                        </FormControl>
                        {createDiscord ? (
                          <>
                            <RoleColorField
                              value={roleColorHex}
                              onChange={setRoleColorHex}
                              helper="Defaults from Edit Panel; change it for this role only."
                            />
                            <FormControl>
                              <FormLabel>Override text channel category</FormLabel>
                              <ChannelSelect
                                channels={categories}
                                value={textCategoryId}
                                onChange={setTextCategoryId}
                                includeEmptyLabel="Use panel default"
                                prefix=""
                              />
                            </FormControl>
                            {createVoice && (
                              <FormControl isRequired>
                                <FormLabel>Override voice channel category</FormLabel>
                                <ChannelSelect
                                  channels={categories}
                                  value={voiceCategoryId}
                                  onChange={setVoiceCategoryId}
                                  includeEmptyLabel="Use panel default"
                                  prefix=""
                                />
                              </FormControl>
                            )}
                          </>
                        ) : (
                          <FormControl isRequired>
                            <FormLabel>Role</FormLabel>
                            <Select
                              value={roleId}
                              onChange={(e) => {
                                const id = e.target.value
                                setRoleId(id)
                                setRoleName(roles.find((r) => r.id === id)?.name || '')
                              }}
                              {...selectProps}
                            >
                              <option value="">Select a role...</option>
                              {available.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </>
                    ) : (
                      <FormControl>
                        <FormLabel>Discord role name</FormLabel>
                        <Input value={roleName} isReadOnly {...inputBg} />
                        <FormHelperText>Role name cannot be changed (managed by Discord)</FormHelperText>
                      </FormControl>
                    )}

                    {isTeamPanel && (
                      <FormControl>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                          rows={2}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="DRS (Platinum)"
                          {...inputBg}
                        />
                        <FormHelperText>Filled from series and division; you can override it.</FormHelperText>
                      </FormControl>
                    )}

                    <FormControl>
                      <FormLabel>Emoji</FormLabel>
                      <Input value={emoji} maxLength={10} onChange={(e) => setEmoji(e.target.value)} placeholder="🔹" {...inputBg} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Button color</FormLabel>
                      <Select value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} {...selectProps}>
                        {BUTTON_COLOR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <Checkbox isChecked={isTeamRole} onChange={(e) => setIsTeamRole(e.target.checked)} colorScheme="red">
                        Is team role
                      </Checkbox>
                    </FormControl>
                    <FormControl>
                      <Checkbox isChecked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} colorScheme="red">
                        Requires approval
                      </Checkbox>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Required roles (prerequisites)</FormLabel>
                      <RoleChecklist roles={roles} selected={requiredRoles} onChange={setRequiredRoles} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Approval channel override</FormLabel>
                      <ChannelSelect
                        channels={channels}
                        value={roleApprovalChannelId}
                        onChange={setRoleApprovalChannelId}
                        includeEmptyLabel="Use panel default"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Visibility</FormLabel>
                      <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} {...selectProps}>
                        <option value="public">Public</option>
                        <option value="hidden">Hidden</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Sort index</FormLabel>
                      <Input type="number" value={sortIndex} onChange={(e) => setSortIndex(Number(e.target.value || 0))} {...inputBg} />
                    </FormControl>

                    {mode === 'edit' && (
                      <>
                        <FormControl>
                          <FormLabel>Linked private text channel</FormLabel>
                          <ChannelSelect
                            channels={channels}
                            value={textChannelId}
                            onChange={setTextChannelId}
                            includeEmptyLabel="None"
                          />
                          <FormHelperText>Attach a manually created channel so delete can remove it later</FormHelperText>
                        </FormControl>
                        <FormControl>
                          <FormLabel>Linked private voice channel</FormLabel>
                          <ChannelSelect
                            channels={voiceChannels}
                            value={voiceChannelId}
                            onChange={setVoiceChannelId}
                            includeEmptyLabel="None"
                            prefix=""
                          />
                        </FormControl>
                      </>
                    )}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }} mr={3} onClick={onClose}>Cancel</Button>
          <Button
            colorScheme="red"
            isLoading={submitting}
            isDisabled={mode === 'add' && addDisabled}
            onClick={() => onSubmit(collect())}
          >
            {primaryLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export function DeleteRoleModal({
  isOpen,
  onClose,
  panel,
  role,
  channels,
  voiceChannels,
  submitting,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  panel: RolePanel | null
  role: PanelRole | null
  channels: TextChannel[]
  voiceChannels: TextChannel[]
  submitting: boolean
  onConfirm: (deleteDiscordEntities: boolean) => void
}) {
  if (!panel || !role) return null
  const textName = role.textChannelId ? channelName([...channels, ...voiceChannels], role.textChannelId) : null
  const voiceName = role.voiceChannelId ? channelName(voiceChannels, role.voiceChannelId) : null
  const hasLinkedChannels = Boolean(role.textChannelId || role.voiceChannelId)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white">
        <ModalHeader>Remove {role.roleName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text>This will remove the role from the <strong>{panel.name}</strong> panel.</Text>
            <Box border="1px solid" borderColor="whiteAlpha.300" rounded="md" p={3} fontSize="sm">
              <Text>Discord role: @{role.roleName}</Text>
              <Text>Text channel: {textName ? `#${textName}` : 'none linked'}</Text>
              <Text>Voice channel: {voiceName || 'none linked'}</Text>
            </Box>
            {!hasLinkedChannels && (
              <Alert status="info" bg="black" color="white" rounded="md">
                <AlertIcon />
                No linked channels in config. Deleting Discord entities will still delete the role; attach channels in Edit first if you want those removed too.
              </Alert>
            )}
            <Text fontSize="sm" color="red.300">
              Deleting Discord entities removes the role from every member who has it.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }} mr={3} onClick={onClose} isDisabled={submitting}>Cancel</Button>
          <Button
            variant="outline"
            colorScheme="red"
            mr={3}
            isLoading={submitting}
            onClick={() => onConfirm(false)}
          >
            Remove from panel only
          </Button>
          <Button colorScheme="red" isLoading={submitting} onClick={() => onConfirm(true)}>
            Delete Discord role and channels
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
