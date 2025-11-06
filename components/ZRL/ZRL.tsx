import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Stack,
  Button,
  Center,
  Divider,
  SimpleGrid,
  Link,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { auth, db } from '@/app/utils/firebaseConfig';
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';

import NextLink from 'next/link';
import ZRLRider from './ZRLRider';
import ZRLRiderEditDelete from './ZRLRiderEditDelete';

// -----------------------------------------------------------
// TYPES
// -----------------------------------------------------------
interface Rider {
  id?: string;
  userId: string;
  name: string;
  division: string;
  rideTime: string;
  raceSeries?: string; // The rider's chosen race series
}

interface Team {
  id?: string;
  name: string;
  captainDiscordId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string; // For Club Ladder, it's often an empty string or undefined
  lookingForRiders?: boolean;
  raceSeries?: string; // The team's chosen race series
}

// -----------------------------------------------------------
// ORDER SETTINGS FOR EACH RACE SERIES
// -----------------------------------------------------------
const raceSeriesDivisionOrder: Record<string, string[]> = {
  'WTRL ZRL': ['A', 'B', 'C', 'D'],
  'WTRL TTT': ['Doppio', 'Espresso', 'Frappe', 'Latte', 'Mocha'],
  'DRS': [
    'Diamond',
    'Ruby',
    'Emerald',
    'Sapphire',
    'Amethyst',
    'Gold',
    'Bronze',
    'Platinum',
    'Silver',
  ],
  // For Club Ladder, we can show a single column named "No Division"
  'Club Ladder': [''],
};

// -----------------------------------------------------------
// HELPER: GROUP TEAMS BY DIVISION
// -----------------------------------------------------------
/**
 * 1) If raceSeries === 'WTRL ZRL', then A1/A2/A3 => group "A", B1/B2/B3 => group "B", etc.
 * 2) If raceSeries === 'Club Ladder', teams have no division, so put them in a single "No Division" column.
 * 3) Otherwise (WTRL TTT, DRS, etc.), group by the entire division string (e.g. "Doppio", "Espresso", etc.).
 */
function groupTeamsByDivision(teams: Team[], raceSeries: string): Record<string, Team[]> {
  // Special case for "Club Ladder" – just put all teams in "No Division"
  if (raceSeries === 'Club Ladder') {
    return {
      '': teams,
    };
  }

  const divisionGroups: Record<string, Team[]> = {};

  teams.forEach((team) => {
    // By default, group by full division string
    let groupKey = team.division;

    // For WTRL ZRL, reduce A1/A2/A3 => "A", B1/B2/B3 => "B", etc.
    if (raceSeries === 'WTRL ZRL') {
      const firstLetter = team.division?.charAt(0).toUpperCase() || '';
      if (['A', 'B', 'C', 'D'].includes(firstLetter)) {
        groupKey = firstLetter;
      } else {
        // If you want to skip unexpected divisions (like "") or something else:
        // groupKey = 'Other'; // or skip them:
        return;
      }
    }

    if (!divisionGroups[groupKey]) {
      divisionGroups[groupKey] = [];
    }
    divisionGroups[groupKey].push(team);
  });

  // Sort each group by rideTime
  Object.keys(divisionGroups).forEach((key) => {
    divisionGroups[key].sort((a, b) => {
      const [hA, mA] = a.rideTime.split(':').map(Number);
      const [hB, mB] = b.rideTime.split(':').map(Number);
      return (hA * 60 + mA) - (hB * 60 + mB);
    });
  });

  return divisionGroups;
}

// -----------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------
const ZRL = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [interestedRiders, setInterestedRiders] = useState<Rider[]>([]);

  // For editing riders
  const [isRiderEditMode, setIsRiderEditMode] = useState(false);
  const [currentRider, setCurrentRider] = useState<Rider | null>(null);

  // -------------------------------------------------------
  // LOAD TEAMS FROM BACKEND-MANAGED ROLES
  // -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats/captain-roles', { cache: 'no-store' });
        const data = await res.json();
        const roles: any[] = Array.isArray(data?.roles) ? data.roles : [];
        // Derive Team[] from roles marked as team roles
        const teamRows: Team[] = roles
          .filter((r: any) => !!r?.isTeamRole)
          .map((r: any) => ({
            id: String(r.roleId),
            name: String(r.teamName || r.roleName || r.roleId),
            captainDiscordId: r.teamCaptainId ? String(r.teamCaptainId) : '',
            captainName: r.captainDisplayName ? String(r.captainDisplayName) : '',
            createdAt: '',
            rideTime: r.rideTime ? String(r.rideTime) : '',
            division: r.division ? String(r.division) : '',
            raceSeries: r.raceSeries ? String(r.raceSeries) : undefined,
            lookingForRiders: !!r.lookingForRiders,
            teamRoleId: String(r.roleId),
          }));
        if (!cancelled) setTeams(teamRows);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------
  // LISTEN FOR RIDERS
  // -------------------------------------------------------
  useEffect(() => {
    const ridersRef = collection(db, 'riders');
    const unsubscribe = onSnapshot(ridersRef, (snapshot) => {
      const ridersList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Rider[];
      setInterestedRiders(ridersList);
    });
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------
  // TEAM ACTIONS
  // -------------------------------------------------------
  const handleDeleteTeam = async (teamId: string) => {
    try {
      const teamRef = doc(db, 'teams', teamId);
      await deleteDoc(teamRef);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  // -------------------------------------------------------
  // RIDER ACTIONS
  // -------------------------------------------------------
  const openRiderEditModal = (rider: Rider) => {
    setCurrentRider(rider);
    setIsRiderEditMode(true);
  };

  const closeRiderEditModal = () => {
    setCurrentRider(null);
    setIsRiderEditMode(false);
  };

  const handleDeleteRider = async (riderId: string) => {
    try {
      const riderRef = doc(db, 'riders', riderId);
      await deleteDoc(riderRef);
    } catch (error) {
      console.error('Error deleting rider:', error);
    }
  };

  // -------------------------------------------------------
  // FILTER TEAMS & RIDERS BY RACE SERIES
  // -------------------------------------------------------
  const filterTeamsBySeries = (series: string) =>
    teams.filter((team) => team.raceSeries === series);

  const filterRidersBySeries = (series: string) =>
    interestedRiders.filter((rider) => rider.raceSeries === series);

  // -------------------------------------------------------
  // RENDER TEAMS
  // -------------------------------------------------------
  const renderTeams = (filteredTeams: Team[], raceSeries: string) => {
    // 1) Group them
    const divisionGroups = groupTeamsByDivision(filteredTeams, raceSeries);

    // 2) We have a specific order for columns
    const order = raceSeriesDivisionOrder[raceSeries] || [];

    // We'll keep only the divisions in 'order' that actually exist in the grouping
    const divisionsToShow = order.filter((div) => divisionGroups[div]);

    // If no divisions to show, show "No teams found"
    if (divisionsToShow.length === 0) {
      return <Text textColor="white">No teams found in this series.</Text>;
    }

    // 3) Render columns in that order
    return (
      <SimpleGrid spacing={4} minChildWidth="250px" marginBlockEnd={4} textColor="white">
        {divisionsToShow.map((divisionKey) => {
          const teamsInGroup = divisionGroups[divisionKey];
          return (
            <Box key={divisionKey}>
              {/* 
                For ZRL: "Division A", "Division B" etc.
                For TTT/DRS: the full string (e.g. "Doppio")
                For Club Ladder: "No Division"
              */}
              {raceSeries === 'WTRL ZRL' ? (
                <Heading size="lg" mb={2}>
                  Division {divisionKey}
                </Heading>
              ) : (
                <Heading size="lg" mb={2}>
                  {divisionKey}
                </Heading>
              )}

              {teamsInGroup.map((team) => (
                <Box
                  key={team.id}
                  borderWidth="1px"
                  borderRadius="lg"
                  p={4}
                  mb={2}
                >
                  <Heading size="md">
                    {team.rideTime}: {team.name}
                  </Heading>
                  <Text>
                    Captain: {team.captainName}
                    <br />
                    Division: {team.division || '(none)'}
                  </Text>
                  {team.lookingForRiders && (
                    <Text color="yellow">Looking for riders</Text>
                  )}
                  {(team as any).captainDiscordId && (team as any).captainDiscordId === (auth as any)?.currentUser?.uid /* fallback removed - we use discordId elsewhere */}
                  {false && (
                    <Stack direction="row" spacing={3} mt={2}>
                      <Button as={NextLink} href="/members-zone/team-management" colorScheme="yellow">
                        Manage
                      </Button>
                    </Stack>
                  )}
                </Box>
              ))}
            </Box>
          );
        })}
      </SimpleGrid>
    );
  };

  // -------------------------------------------------------
  // RENDER RIDERS
  // -------------------------------------------------------
  const renderRiders = (filteredRiders: Rider[]) => {
    if (filteredRiders.length === 0) {
      return <Text textColor="white">No interested riders yet.</Text>;
    }

    return (
      <SimpleGrid
        spacing={4}
        templateColumns="repeat(auto-fit, minmax(200px, 300px))"
        marginBlockEnd={4}
        textColor="white"
      >
        {filteredRiders.map((rider) => (
          <Box
            key={rider.id}
            borderWidth="1px"
            borderRadius="lg"
            p={4}
            mb={2}
          >
            <Heading size="md">{rider.name}</Heading>
            <Text>
              Preferred Division: {rider.division}
              <br />
              Preferred Race Time: {rider.rideTime}
            </Text>
            {rider.userId === auth.currentUser?.uid && (
              <Stack direction="row" spacing={3} mt={2}>
                <Button colorScheme="yellow" onClick={() => openRiderEditModal(rider)}>
                  Edit
                </Button>
                <Button
                  colorScheme="red"
                  onClick={() => handleDeleteRider(rider.id!)}
                >
                  Delete
                </Button>
              </Stack>
            )}
          </Box>
        ))}
      </SimpleGrid>
    );
  };

  // -------------------------------------------------------
  // MAIN RENDER
  // -------------------------------------------------------
  return (
    <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}} py={6}>
      <Box textColor="white">
      <Center>
        <Heading as="h2" size="lg" mb={4}>
          DZR Racing Teams
        </Heading>
      </Center>
      <Divider mt={4} />

      <Text mr={4} mt={4}>
        Få et overblik over DZR-hold på tværs af løbsserier, og se hvilke hold der søger ryttere.
        Har du idéer til forbedringer? Del dem gerne på{' '}
        <Link href="https://discord.gg/22t8MvWK" target="_blank" isExternal color="blue.300">Discord <ExternalLinkIcon mx="2px" /></Link>.
      </Text>

      <Text mr={4} mt={4}>
        <strong>• For holdkaptajner:</strong> Opret og redigér jeres hold i Team Management. Her kan du også slå jeres hold op som “Looking for riders”.
      </Text>
      <Button as={NextLink} href="/members-zone/team-management" colorScheme="blue" variant="outline" mt={4}>
        Team Management
      </Button>

      <Text mr={4} mt={4}>
        <strong>• Ryttere</strong> kan flage interesse i at finde et team.
        Detaljer kan ændres af rytteren, når interessen er oprettet (Edit) og
        slettes (Delete).
      </Text>
      <ZRLRider />

      <Divider mb={4} />

      {/* 
        TABS for the 4 race series:
        "WTRL ZRL", "WTRL TTT", "DRS", "Club Ladder"
      */}
      <Tabs variant="enclosed" mt={8}>
        <TabList mb={4}>
          <Tab>WTRL ZRL</Tab>
          <Tab>WTRL TTT</Tab>
          <Tab>DRS</Tab>
          <Tab>Club Ladder</Tab>
        </TabList>

        <TabPanels>
          {/* WTRL ZRL */}
          <TabPanel>
            <Heading size="xl" mb={4}>
              Current Teams (WTRL ZRL)
            </Heading>
            {renderTeams(filterTeamsBySeries('WTRL ZRL'), 'WTRL ZRL')}

            <Divider my={8} />

            <Heading size="xl" mb={4}>
              Riders Looking For Team (WTRL ZRL)
            </Heading>
            {renderRiders(filterRidersBySeries('WTRL ZRL'))}
          </TabPanel>

          {/* WTRL TTT */}
          <TabPanel>
            <Heading size="xl" mb={4}>
              Current Teams (WTRL TTT)
            </Heading>
            {renderTeams(filterTeamsBySeries('WTRL TTT'), 'WTRL TTT')}

            <Divider my={8} />

            <Heading size="xl" mb={4}>
              Riders Looking For Team (WTRL TTT)
            </Heading>
            {renderRiders(filterRidersBySeries('WTRL TTT'))}
          </TabPanel>

          {/* DRS */}
          <TabPanel>
            <Heading size="xl" mb={4}>
              Current Teams (DRS)
            </Heading>
            {renderTeams(filterTeamsBySeries('DRS'), 'DRS')}

            <Divider my={8} />

            <Heading size="xl" mb={4}>
              Riders Looking For Team (DRS)
            </Heading>
            {renderRiders(filterRidersBySeries('DRS'))}
          </TabPanel>

          {/* Club Ladder */}
          <TabPanel>
            <Heading size="xl" mb={4}>
              Current Teams (Club Ladder)
            </Heading>
            {renderTeams(filterTeamsBySeries('Club Ladder'), 'Club Ladder')}

            <Divider my={8} />

            <Heading size="xl" mb={4}>
              Riders Looking For Team (Club Ladder)
            </Heading>
            {renderRiders(filterRidersBySeries('Club Ladder'))}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Conditionally render the Edit Rider modal */}
      {isRiderEditMode && currentRider && (
        <ZRLRiderEditDelete rider={currentRider} onClose={closeRiderEditModal} />
      )}
      </Box>
    </Container>
  );
};

export default ZRL;
