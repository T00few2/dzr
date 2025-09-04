'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Box,
  Container,
  Heading,
  Text,
  Stack,
  Button,
  Divider,
  SimpleGrid,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Avatar,
  HStack,
  Input,
  FormControl,
  FormLabel,
  Select,
  Switch,
} from '@chakra-ui/react';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import ZRLRegister from '@/components/ZRL/ZRLRegister';
import ZRLEditDelete from '@/components/ZRL/ZRLEditDelete';
import { auth, db } from '@/app/utils/firebaseConfig';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import SendMessage from '@/components/discord-bot/SendMessage';

interface Team {
  id?: string;
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
  raceSeries?: string;
  lookingForRiders?: boolean;
  teamRoleId?: string;
}

type RiderRow = {
  riderId: number;
  name: string;
  zpCategory?: string;
  racingScore?: number;
  veloRating?: number;
  phenotype?: string;
};

export default function TeamManagementPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [editTeam, setEditTeam] = useState<Team | null>(null);

  useEffect(() => {
    const teamsRef = collection(db, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const teamsList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Team[];
      setTeams(teamsList);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = Boolean((session?.user as any)?.isAdmin);
  const myTeams = isAdmin ? teams : teams.filter((t) => (t as any).captainDiscordId === (session?.user as any)?.discordId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!selectedTeamId && myTeams.length > 0) {
      setSelectedTeamId(myTeams[0].id || null);
    }
  }, [selectedTeamId, myTeams]);
  const selectedTeam = myTeams.find(t => t.id === selectedTeamId) || null;

  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [captainRoles, setCaptainRoles] = useState<{ roleId: string; roleName: string; zwiftIds: string[] }[]>([]);
  const [discordProfilesByZwift, setDiscordProfilesByZwift] = useState<Record<string, { displayName: string; avatarUrl?: string; discordId?: string }>>({});
  const [membersByRole, setMembersByRole] = useState<Record<string, { discordId: string; displayName: string; avatarUrl?: string; zwiftId?: string }[]>>({});
  const [addInputs, setAddInputs] = useState<Record<string, string>>({}); // roleId -> discordId to add
  const [searchInputs, setSearchInputs] = useState<Record<string, string>>({}); // roleId -> search query
  const [searchResults, setSearchResults] = useState<Record<string, RiderRow[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<string, boolean>>({});
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>({});
  const [addIdLoading, setAddIdLoading] = useState<Record<string, boolean>>({});
  const [addSearchLoading, setAddSearchLoading] = useState<Record<string, boolean>>({});

  // Removed legacy members-by-role fetch (now using stats endpoints)

  // Load riders dataset and captain roles (reuse stats endpoints)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setDataLoading(true);
        const [ridersRes, rolesRes] = await Promise.all([
          fetch('/api/stats/riders?limit=10000'),
          fetch('/api/stats/captain-roles', { cache: 'no-store' }),
        ]);
        const ridersJson = await ridersRes.json();
        const rolesJson = await rolesRes.json();
        if (!cancelled) {
          setRiders(Array.isArray(ridersJson?.items) ? ridersJson.items : []);
          const roles: { roleId: string; roleName?: string; zwiftIds?: string[] }[] = rolesJson?.roles || [];
          setCaptainRoles(
            roles.map(r => ({ roleId: String(r.roleId), roleName: r.roleName || String(r.roleId), zwiftIds: Array.isArray(r.zwiftIds) ? r.zwiftIds.map(String) : [] }))
          );
          const profilesArr: { zwiftId: string; displayName?: string; avatarUrl?: string; discordId?: string }[] = rolesJson?.profiles || [];
          const map: Record<string, { displayName: string; avatarUrl?: string; discordId?: string }> = {};
          profilesArr.forEach((p) => { if (p.zwiftId) map[String(p.zwiftId)] = { displayName: p.displayName || '', avatarUrl: p.avatarUrl, discordId: p.discordId }; });
          setDiscordProfilesByZwift(map);
          const mbr: Record<string, { discordId: string; displayName: string; avatarUrl?: string; zwiftId?: string }[]> = rolesJson?.membersByRole || {};
          setMembersByRole(mbr);
        }
      } catch {}
      finally { if (!cancelled) setDataLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const refreshMembersData = async () => {
    try {
      setDataLoading(true);
      const res = await fetch('/api/stats/captain-roles', { cache: 'no-store' });
      if (!res.ok) return;
      const rolesJson = await res.json();
      const roles: { roleId: string; roleName?: string; zwiftIds?: string[] }[] = rolesJson?.roles || [];
      setCaptainRoles(
        roles.map(r => ({ roleId: String(r.roleId), roleName: r.roleName || String(r.roleId), zwiftIds: Array.isArray(r.zwiftIds) ? r.zwiftIds.map(String) : [] }))
      );
      const profilesArr: { zwiftId: string; displayName?: string; avatarUrl?: string; discordId?: string }[] = rolesJson?.profiles || [];
      const map: Record<string, { displayName: string; avatarUrl?: string; discordId?: string }> = {};
      profilesArr.forEach((p) => { if (p.zwiftId) map[String(p.zwiftId)] = { displayName: p.displayName || '', avatarUrl: p.avatarUrl, discordId: p.discordId }; });
      setDiscordProfilesByZwift(map);
      const mbr: Record<string, { discordId: string; displayName: string; avatarUrl?: string; zwiftId?: string }[]> = rolesJson?.membersByRole || {};
      setMembersByRole(mbr);
    } catch {}
    finally { setDataLoading(false); }
  };

  const handleDeleteTeam = async (teamId?: string) => {
    if (!teamId) return;
    try {
      const teamRef = doc(db, 'teams', teamId);
      await deleteDoc(teamRef);
    } catch (e) {
      console.error('Failed to delete team', e);
    }
  };

  if (status === 'loading') {
    return <LoadingSpinnerMemb/>;
  }

  if (!session?.user) {
    return <Text align='center' color='white'>You need to login.</Text>;
  }

  return (
    <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}} py={6}>
      <Box textColor="white">
      <Stack direction="row" justify="space-between" align="center">
        <Heading size="lg">Team Management</Heading>
        <Button as={Link} href="/members-zone/zrl" background='white' color='black' _hover={{ background: 'whiteAlpha.900' }} variant='solid'>
          Back to Teams Overview
        </Button>
      </Stack>

      <Text mt={2}>
        Create and manage your teams here. This page is restricted to Holdkaptajn.
      </Text>

      <Divider my={6} />

      <Heading size="md" mb={2}>Create a new team</Heading>
      {dataLoading && (<Text color='whiteAlpha.700' mb={2}>Loading…</Text>)}
      <Text color='whiteAlpha.900' mb={3}>
        To create a team, you need the Team Role ID from a Discord admin. Ask an admin for the
        Discord role ID that represents your team.
      </Text>
      <ZRLRegister />

      <Divider my={6} />

      <Heading size="md" mb={2}>Your teams</Heading>
      {myTeams.length === 0 ? (
        <Text>You have not registered any teams yet.</Text>
      ) : (
        <>
          <FormControl maxW={{ base: '100%', sm: '360px' }}>
            <FormLabel color='white'>My teams</FormLabel>
            <Select bg='white' color='black' value={selectedTeamId || ''} onChange={(e) => setSelectedTeamId(e.target.value || null)}>
              {myTeams.map(t => (
                <option key={t.id} value={t.id || ''}>{t.name}{t.raceSeries ? ` • ${t.raceSeries}` : ''}</option>
              ))}
            </Select>
          </FormControl>

          {(() => {
            const team = myTeams.find(t => t.id === selectedTeamId);
            if (!team) return null;
            return (
              <Box mt={4}>
                <Heading size="sm">{team.name}</Heading>
                <Text mt={1}>
                  Series: {team.raceSeries || '-'}
                  <br />
                  Division: {team.division || '(none)'}
                  <br />
                  Race time: {team.rideTime}
                  <br />
                  Team role ID: {team.teamRoleId || '(missing)'}
                </Text>
                <Stack direction="row" spacing={3} mt={3} align="center">
                  <Button colorScheme="yellow" onClick={() => setEditTeam(team)}>Edit</Button>
                  <Button colorScheme="red" onClick={() => handleDeleteTeam(team.id)}>Delete</Button>
                </Stack>
                <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} mt={3} align={{ base: 'flex-start', sm: 'center' }}>
                  <Text>Looking for riders</Text>
                  <Switch
                    colorScheme='green'
                    isChecked={!!team.lookingForRiders}
                    onChange={async (e) => {
                      try {
                        const checked = e.target.checked;
                        const teamRef = doc(db, 'teams', team.id!);
                        await updateDoc(teamRef, { lookingForRiders: checked });
                        // Optional: send discord message when turning on, mirroring edit modal behavior
                        if (checked) {
                          try {
                            const messageContent =
                              '🚨BREAKING🚨\n\n' +
                              '@everyone\n\n' +
                              `${team.name} leder efter nye ryttere.\n` +
                              `${team.name} kører ${team.raceSeries || ''} i ${team.division || ''} klokken ${team.rideTime}.`;
                            await SendMessage('1297934562558611526', messageContent, { mentionEveryone: true });
                          } catch {}
                        }
                        await refreshMembersData();
                      } catch {}
                    }}
                  />
                </Stack>
                {team.teamRoleId && (
                  <Box mt={3}>
                    <Divider my={2} borderColor='whiteAlpha.300' />
                    <Heading size="xs" mb={2}>Members</Heading>
                    {(() => {
                      const role = captainRoles.find(r => r.roleId === team.teamRoleId);
                      const idSet = new Set((role?.zwiftIds || []).map(String));
                      const teamRows = riders.filter(r => idSet.has(String(r.riderId)));
                      const teamRowsIdSet = new Set(teamRows.map(r => String(r.riderId)));
                      const unlinkedMembers = (membersByRole[team.teamRoleId] || []).filter(m => !m.zwiftId);
                      const linkedButMissing = (membersByRole[team.teamRoleId] || []).filter(m => m.zwiftId && !teamRowsIdSet.has(String(m.zwiftId)));
                      return (
                        <Box border='1px solid' borderColor='whiteAlpha.300' rounded='md' overflowX='auto'>
                          <Table size='sm' variant='simple' sx={{ 'th, td': { py: 1, fontSize: 'sm' }, 'thead th': { background: 'black' } }}>
                            <Thead>
                              <Tr>
                                <Th color='white'></Th>
                                <Th color='white'>Name</Th>
                                <Th color='white'>ZwiftID</Th>
                                <Th color='white'>ZPG</Th>
                                <Th color='white'>ZRS</Th>
                                <Th color='white'>vELO</Th>
                                <Th color='white'>Phenotype</Th>
                                <Th color='white'>Actions</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {teamRows.map((r) => {
                                const profile = discordProfilesByZwift[String(r.riderId)];
                                return (
                                  <Tr key={r.riderId}>
                                    <Td>
                                      <HStack>
                                        <Avatar size='sm' name={profile?.displayName || r.name} src={profile?.avatarUrl} />
                                      </HStack>
                                    </Td>
                                    <Td color='white'>{profile?.displayName || r.name}</Td>
                                    <Td color='white'>{r.riderId}</Td>
                                    <Td color='white'>{r.zpCategory ?? '—'}</Td>
                                    <Td color='white'>{r.racingScore != null ? Math.round(r.racingScore) : '—'}</Td>
                                    <Td color='white'>{r.veloRating != null ? Math.round(r.veloRating) : '—'}</Td>
                                    <Td color='white'>{r.phenotype ?? '—'}</Td>
                                    <Td>
                                      <Button
                                        size='xs'
                                        colorScheme='red'
                                        isDisabled={!team.teamRoleId}
                                        isLoading={!!removeLoading[`rm_zid:${team.teamRoleId}:${r.riderId}`]}
                                        onClick={async () => {
                                          try {
                                            const key = `rm_zid:${team.teamRoleId}:${r.riderId}`;
                                            setRemoveLoading((p) => ({ ...p, [key]: true }));
                                            const res = await fetch('/api/stats/captain-roles', { cache: 'no-store' });
                                            const data = await res.json();
                                            const profilesArr: { zwiftId: string; discordId?: string }[] = data?.profiles || [];
                                            const match = profilesArr.find((p: any) => String(p.zwiftId) === String(r.riderId));
                                            const did = match?.discordId;
                                            if (!did) { alert('Discord ID not linked for this rider.'); return; }
                                            const rm = await fetch('/api/team/remove-member', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ roleId: team.teamRoleId, discordId: did, reason: 'Removed via Team Management' })
                                            });
                                            if (!rm.ok) {
                                              const err = await rm.json().catch(() => ({}));
                                              alert(`Failed to remove: ${err?.error || rm.status}`);
                                              return;
                                            }
                                            alert('Member removed from team role.');
                                            await new Promise((res) => setTimeout(res, 1200));
                                            await refreshMembersData();
                                          } catch (e: any) {
                                            alert('Failed to remove member.');
                                          } finally {
                                            const key = `rm_zid:${team.teamRoleId}:${r.riderId}`;
                                            setRemoveLoading((p) => ({ ...p, [key]: false }));
                                          }
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </Td>
                                  </Tr>
                                );
                              })}
                              {linkedButMissing.map((m) => {
                                const zid = String(m.zwiftId);
                                const profile = discordProfilesByZwift[zid];
                                return (
                                  <Tr key={`linked_missing_${zid}`}>
                                    <Td>
                                      <HStack>
                                        <Avatar size='sm' name={profile?.displayName || m.displayName} src={profile?.avatarUrl || m.avatarUrl} />
                                      </HStack>
                                    </Td>
                                    <Td color='white'>{profile?.displayName || m.displayName}</Td>
                                    <Td color='white'>{zid}</Td>
                                    <Td color='white'>—</Td>
                                    <Td color='white'>—</Td>
                                    <Td color='white'>—</Td>
                                    <Td color='white'>—</Td>
                                    <Td>
                                      <Button
                                        size='xs'
                                        colorScheme='red'
                                        isDisabled={!team.teamRoleId}
                                        isLoading={!!removeLoading[`rm_did:${team.teamRoleId}:${m.discordId}`]}
                                        onClick={async () => {
                                          try {
                                            const key = `rm_did:${team.teamRoleId}:${m.discordId}`;
                                            setRemoveLoading((p) => ({ ...p, [key]: true }));
                                            const rm = await fetch('/api/team/remove-member', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ roleId: team.teamRoleId, discordId: m.discordId, reason: 'Removed via Team Management' })
                                            });
                                            if (!rm.ok) {
                                              const err = await rm.json().catch(() => ({}));
                                              alert(`Failed to remove: ${err?.error || rm.status}`);
                                              return;
                                            }
                                            alert('Member removed from team role.');
                                            await new Promise((res) => setTimeout(res, 1200));
                                            await refreshMembersData();
                                          } catch {
                                            alert('Failed to remove member.');
                                          } finally {
                                            const key = `rm_did:${team.teamRoleId}:${m.discordId}`;
                                            setRemoveLoading((p) => ({ ...p, [key]: false }));
                                          }
                                        }}
                                      >
                                        Remove
                                      </Button>
                                    </Td>
                                  </Tr>
                                );
                              })}
                              {unlinkedMembers.length > 0 && (
                                <Tr>
                                  <Td colSpan={8}>
                                    <Box>
                                      <Text color='white' fontWeight='bold' mb={1}>Unlinked members (no ZwiftID)</Text>
                                      <Stack spacing={1}>
                                        {unlinkedMembers.map((m) => (
                                          <HStack key={m.discordId} spacing={2}>
                                            <Avatar size='sm' name={m.displayName} src={m.avatarUrl} />
                                            <Text color='white'>{m.displayName}</Text>
                                          </HStack>
                                        ))}
                                      </Stack>
                                    </Box>
                                  </Td>
                                </Tr>
                              )}
                            </Tbody>
                          </Table>
                        </Box>
                      );
                    })()}

                    {/* Add rider by Zwift ID */}
                    {(() => {
                      const roleId = team.teamRoleId || '';
                      const inputVal = roleId ? (addInputs[roleId] || '') : '';
                      return (
                        <Box mt={4}>
                          <Heading size='xs' mb={1}>Add rider with Zwift ID</Heading>
                          <Text fontSize='sm' color='whiteAlpha.800' mb={2}>Paste the rider&apos;s Zwift ID and click Add.</Text>
                          <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} align={{ base: 'stretch', sm: 'flex-end' }}>
                            <FormControl maxW={{ sm: '280px' }}>
                              <FormLabel m={0} fontSize='sm' color='white'>Zwift ID</FormLabel>
                              <Input
                                size='sm'
                                bg='white'
                                color='black'
                                placeholder='e.g. 123456'
                                value={inputVal}
                                onChange={(e) => {
                                  if (!roleId) return;
                                  setAddInputs((prev) => ({ ...prev, [roleId]: e.target.value }));
                                }}
                              />
                            </FormControl>
                            <Button
                              size='sm'
                              colorScheme='green'
                              isDisabled={!roleId || !addInputs[roleId]}
                              isLoading={!!addIdLoading[`add_id:${roleId}`]}
                              onClick={async () => {
                                try {
                                  const key = `add_id:${roleId}`;
                                  setAddIdLoading((p) => ({ ...p, [key]: true }));
                                  const zid = (addInputs[roleId] || '').trim();
                                  if (!zid) return;
                                  const resp = await fetch('/api/team/add-member', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ roleId, zwiftId: zid, reason: 'Added via Team Management' }),
                                  });
                                  if (!resp.ok) {
                                    const err = await resp.json().catch(() => ({}));
                                    alert(`Failed to add: ${err?.error || resp.status}`);
                                    return;
                                  }
                                  alert('Member added to team role.');
                                  setAddInputs((prev) => ({ ...prev, [roleId]: '' }));
                                  await refreshMembersData();
                                } catch {
                                  alert('Failed to add member.');
                                } finally {
                                  const key = `add_id:${roleId}`;
                                  setAddIdLoading((p) => ({ ...p, [key]: false }));
                                }
                              }}
                            >
                              Add rider
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })()}

                    {/* Search club stats and add */}
                    {(() => {
                      const roleId = team.teamRoleId || '';
                      const q = roleId ? (searchInputs[roleId] || '') : '';
                      const results = roleId ? (searchResults[roleId] || []) : [];
                      const isLoading = roleId ? !!searchLoading[roleId] : false;
                      return (
                        <Box mt={5}>
                          <Heading size='xs' mb={1}>Add rider from database</Heading>
                          <Text fontSize='sm' color='whiteAlpha.800' mb={2}>Search your club stats by rider name and add directly.</Text>
                          <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} align={{ base: 'stretch', sm: 'flex-end' }} mb={2}>
                            <FormControl maxW={{ sm: '320px' }}>
                              <FormLabel m={0} fontSize='sm' color='white'>Rider name</FormLabel>
                              <Input
                                size='sm'
                                bg='white'
                                color='black'
                                placeholder='e.g. Jane Doe'
                                value={q}
                                onChange={(e) => {
                                  if (!roleId) return;
                                  setSearchInputs((prev) => ({ ...prev, [roleId]: e.target.value }));
                                }}
                              />
                            </FormControl>
                            <Button
                              size='sm'
                              isLoading={isLoading}
                              onClick={async () => {
                                if (!roleId) return;
                                const query = (searchInputs[roleId] || '').trim();
                                if (!query) return;
                                try {
                                  setSearchLoading((prev) => ({ ...prev, [roleId]: true }));
                                  const res = await fetch(`/api/stats/riders?search=${encodeURIComponent(query)}&limit=20`);
                                  const data = await res.json();
                                  const items: RiderRow[] = Array.isArray(data?.items) ? data.items : [];
                                  setSearchResults((prev) => ({ ...prev, [roleId]: items }));
                                } catch {}
                                setSearchLoading((prev) => ({ ...prev, [roleId]: false }));
                              }}
                            >
                              Search
                            </Button>
                          </Stack>
                          {results.length > 0 && (
                            <Box border='1px solid' borderColor='whiteAlpha.300' rounded='md' overflowX='auto'>
                              <Table size='sm' variant='simple' sx={{ 'th, td': { py: 1, fontSize: 'sm' }, 'thead th': { background: 'black' } }}>
                                <Thead>
                                  <Tr>
                                    <Th color='white'></Th>
                                    <Th color='white'>Name</Th>
                                    <Th color='white'>ZwiftID</Th>
                                    <Th color='white'>Action</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {results.map((r) => {
                                    const profile = discordProfilesByZwift[String(r.riderId)];
                                    return (
                                      <Tr key={`sr_${r.riderId}`}>
                                        <Td>
                                          <HStack>
                                            <Avatar size='sm' name={profile?.displayName || r.name} src={profile?.avatarUrl} />
                                          </HStack>
                                        </Td>
                                        <Td color='white'>{profile?.displayName || r.name}</Td>
                                        <Td color='white'>{r.riderId}</Td>
                                        <Td>
                                          <Button
                                            size='xs'
                                            colorScheme='green'
                                            isLoading={!!addSearchLoading[`add_search:${roleId}:${r.riderId}`]}
                                            onClick={async () => {
                                              try {
                                                const key = `add_search:${roleId}:${r.riderId}`;
                                                setAddSearchLoading((p) => ({ ...p, [key]: true }));
                                                const resp = await fetch('/api/team/add-member', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ roleId, zwiftId: r.riderId, reason: 'Added via Team Management (search)' }),
                                                });
                                                if (!resp.ok) {
                                                  const err = await resp.json().catch(() => ({}));
                                                  alert(`Failed to add: ${err?.error || resp.status}`);
                                                  return;
                                                }
                                                alert('Member added to team role.');
                                                await refreshMembersData();
                                              } catch {}
                                              finally {
                                                const key = `add_search:${roleId}:${r.riderId}`;
                                                setAddSearchLoading((p) => ({ ...p, [key]: false }));
                                              }
                                            }}
                                          >
                                            Add
                                          </Button>
                                        </Td>
                                      </Tr>
                                    );
                                  })}
                                </Tbody>
                              </Table>
                            </Box>
                          )}
                        </Box>
                      );
                    })()}
                  </Box>
                )}
              </Box>
            );
          })()}
        </>
      )}

      {editTeam && (
        <ZRLEditDelete
          team={editTeam}
          onClose={() => setEditTeam(null)}
        />
      )}
      </Box>
    </Container>
  );
}


