'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  AlertIcon,
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
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import type { CategoryChannel, GuildRole, PanelRole, RolePanel, TextChannel } from './types'
import { BUTTON_COLOR_OPTIONS, RACE_SERIES, channelName, parseRoleColor } from './types'

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
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...inputBg}>
      <option value="">{includeEmptyLabel || placeholder || 'Select a channel...'}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>{prefix}{c.name}</option>
      ))}
    </Select>
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
            <FormHelperText>
              New channels are private to the created Discord role and the bot. Category roles such as Member or Holdkaptajn are removed.
            </FormHelperText>
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
              provisioning: {
                createVoice,
                textCategoryId,
                voiceCategoryId,
                extraViewerRoleIds: [],
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

  const canCreate = Boolean(panel?.provisioning?.textCategoryId)
  const createVoice = Boolean(panel?.provisioning?.createVoice)

  useEffect(() => {
    if (!isOpen) return
    setCreateDiscord(false)
    setRoleId(initial?.roleId || '')
    setRoleName(initial?.roleName || '')
    setRoleColorHex('')
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
    setTextChannelId(initial?.textChannelId || '')
    setVoiceChannelId(initial?.voiceChannelId || '')
    setTextCategoryId(panel?.provisioning?.textCategoryId || '')
    setVoiceCategoryId(panel?.provisioning?.voiceCategoryId || '')
    if (mode === 'add' && Boolean(panel?.provisioning?.textCategoryId)) {
      setCreateDiscord(true)
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
  }

  function collect(): RoleFormData {
    return {
      createDiscord: mode === 'add' && createDiscord,
      roleId,
      roleName,
      roleColor: parseRoleColor(roleColorHex),
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white">
        <ModalHeader>{mode === 'add' ? 'Add Role to Panel' : 'Edit Role'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
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
                      Set a text category in Edit Panel before creating Discord roles and channels.
                    </Alert>
                  )}
                </FormControl>
                {createDiscord ? (
                  <>
                    <FormControl isRequired>
                      <FormLabel>Role / team name</FormLabel>
                      <Input
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="e.g. Aero Albatrosses"
                        {...inputBg}
                      />
                      <FormHelperText>
                        {createVoice
                          ? 'Creates a Discord role plus private text and voice channels.'
                          : 'Creates a Discord role plus a private text channel.'}
                      </FormHelperText>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Role color (optional hex)</FormLabel>
                      <Input
                        value={roleColorHex}
                        onChange={(e) => setRoleColorHex(e.target.value)}
                        placeholder="#5865F2"
                        {...inputBg}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Text channel category</FormLabel>
                      <ChannelSelect
                        channels={categories}
                        value={textCategoryId}
                        onChange={setTextCategoryId}
                        includeEmptyLabel="Select a category..."
                        prefix=""
                      />
                    </FormControl>
                    {createVoice && (
                      <FormControl isRequired>
                        <FormLabel>Voice channel category</FormLabel>
                        <ChannelSelect
                          channels={categories}
                          value={voiceCategoryId}
                          onChange={setVoiceCategoryId}
                          includeEmptyLabel="Select a category..."
                          prefix=""
                        />
                        <FormHelperText>Voice channels go in this Discord category, not the text one.</FormHelperText>
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
                      {...inputBg}
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
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button
            colorScheme="red"
            isLoading={submitting}
            isDisabled={mode === 'add' && addDisabled}
            onClick={() => onSubmit(collect())}
          >
            {mode === 'add' ? (createDiscord ? 'Create in Discord' : 'Add Role') : 'Update Role'}
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
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={submitting}>Cancel</Button>
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
