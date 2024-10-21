import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Grid,
  GridItem,
  Text,
  Stack,
  Button,
  Center,
  Flex,
  Divider,
  SimpleGrid,
  Link,
} from '@chakra-ui/react';
import { auth, db } from '@/app/utils/firebaseConfig'; 
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import ZRLRegister from './ZRLRegister';
import ZRLEditDelete from './ZRLEditDelete';
import ZRLRider from './ZRLRider'; // Import the new ZRLRider component
import ZRLRiderEditDelete from './ZRLRiderEditDelete';
import { ExternalLinkIcon } from '@chakra-ui/icons'

interface Rider {
  id?: string; // Optional ID for the rider
  userId: string; // Field to store the user ID of the rider
  name: string; // Rider's name
  division: string; // Rider's division
  rideTime: string; // Preferred race time
}

interface Team {
  id?: string;
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
  lookingForRiders?: boolean; // New field for looking for riders
}

const ZRL = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [interestedRiders, setInterestedRiders] = useState<Rider[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null); // For editing teams
  const [currentRider, setCurrentRider] = useState<Rider | null>(null); // For editing riders
  const [isRiderEditMode, setIsRiderEditMode] = useState(false); // New state for rider edit mode

  // Real-time listener for teams collection
  useEffect(() => {
    const teamsRef = collection(db, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Team[];
      setTeams(teamsList);
    });

    return () => unsubscribeTeams();
  }, []);

  // Real-time listener for riders collection
  useEffect(() => {
    const ridersRef = collection(db, 'riders');
    const unsubscribeRiders = onSnapshot(ridersRef, (snapshot) => {
      const ridersList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Rider[];
      setInterestedRiders(ridersList);
    });

    return () => unsubscribeRiders();
  }, []);

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const teamRef = doc(db, 'teams', teamId);
      await deleteDoc(teamRef);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const openEditModal = (team: Team) => {
    setCurrentTeam(team);
    setEditMode(true);
  };

  const closeEditModal = () => {
    setEditMode(false);
    setCurrentTeam(null);
  };

  const handleDeleteRider = async (riderId: string) => {
    try {
      const riderRef = doc(db, 'riders', riderId);
      await deleteDoc(riderRef);
    } catch (error) {
      console.error('Error deleting rider:', error);
    }
  };

  const openRiderEditModal = (rider: Rider) => {
    setCurrentRider(rider);
    setIsRiderEditMode(true); // Set edit mode for riders
  };

  const closeRiderEditModal = () => {
    setCurrentRider(null);
    setIsRiderEditMode(false); // Reset edit mode for riders
  };

  // Group and sort teams by division and ride time
  const divisionGroups = teams.reduce((acc: { [key: string]: Team[] }, team) => {
    const divisionKey = team.division.charAt(0).toUpperCase();
    if (!acc[divisionKey]) acc[divisionKey] = [];
    acc[divisionKey].push(team);
    return acc;
  }, {});

  // Sort the teams within each division by rideTime
  Object.keys(divisionGroups).forEach((division) => {
    divisionGroups[division].sort((a, b) => {
      const timeA = a.rideTime.split(':').map(Number);
      const timeB = b.rideTime.split(':').map(Number);
      const totalMinutesA = timeA[0] * 60 + timeA[1];
      const totalMinutesB = timeB[0] * 60 + timeB[1];
      return totalMinutesA - totalMinutesB;
    });
  });

  return (
    <Box p={4}>
      <Center>
        <Heading as="h2" size="lg" mb={4} color="white">
          DZR Zwift Racing League Teams
        </Heading>
      </Center>
      <Divider mt={4} />
      
      <Text mr={4} mt={4} color={'white'}>
          Dette er første udgave af en side, hvor man kan få overblik over hvilke hold vi har i ZRL. Derudover kan hold aktivt vise, at de leder efter
          ryttere og ryttere kan vise at de leder efter et hold. Feedback og forslag er meget velkomne på <Link href='https://discord.gg/22t8MvWK' target='_Blank' isExternal color="blue.300">Discord <ExternalLinkIcon mx='2px' /></Link>
        </Text>
      
        <Text mr={4} mt={4} color={'white'}>
        <strong>• Holdkaptajner</strong> kan registere hold. Detaljer kan ændres af kaptajnen, når holdet er oprettet &#40;Edit&#41; og slettes &#40;Delete&#41;. Kryds af i "Looking for riders"
          for at vise at I aktivt leder efter flere ryttere.
        </Text>
        <ZRLRegister />
      
        <Text mr={4} mt={4} color={'white'}>
        <strong>• Ryttere</strong> kan flage interesse i at finde et team. Detaljer kan ændres af rytteren, når interessen er oprettet &#40;Edit&#41; og slettes &#40;Delete&#41;.
        </Text>
        <ZRLRider />

      <Divider mb={4} />
      <Heading size="lg" color="white" mb={4}>
          Current Teams
        </Heading>
      <Grid templateColumns="repeat(4, 1fr)" gap={4}>
        {['A', 'B', 'C', 'D'].map((division) => (
          <GridItem key={division}>
            <Heading size="md" color="white" mb={2}>{`Division ${division}`}</Heading>
            {divisionGroups[division]?.map((team) => (
              <Box key={team.id} borderWidth="1px" borderRadius="lg" p={4} color="white" mb={2}>
                <Text>
                  Name: {team.name}<br />Captain: {team.captainName}<br />Race Time: {team.rideTime}<br />Division: {team.division}
                </Text>
                {team.lookingForRiders && (
                  <Text color="yellow">Looking for riders</Text>
                )}
                {team.captainId === auth.currentUser?.uid && (
                  <Stack direction="row" spacing={3} mt={2}>
                    <Button colorScheme="yellow" onClick={() => openEditModal(team)}>
                      Edit
                    </Button>
                    <Button colorScheme="red" onClick={() => handleDeleteTeam(team.id!)}>
                      Delete
                    </Button>
                  </Stack>
                )}
              </Box>
            ))} 
          </GridItem>
        ))}
      </Grid>
      <Divider mb={4} mt={4}/>
      {/* Interested Riders Section */}
      <Box mt={4}>
        <Heading size="lg" color="white" mb={4}>
          Riders Looking For Team
        </Heading>
        <SimpleGrid 
  spacing={4} 
  templateColumns="repeat(auto-fit, minmax(200px, 300px))" 
  marginBlockEnd={4}
>
        {interestedRiders.length > 0 ? (
          interestedRiders.map((rider) => (
           
            <Box key={rider.userId} borderWidth="1px" borderRadius="lg" p={4} color="white" mb={2}>
              <Text>
                Name: {rider.name}<br />Preferred Division: {rider.division}<br />Preferred Race Time: {rider.rideTime}
              </Text>
              {rider.userId === auth.currentUser?.uid && ( // Check if the current user is the rider
                <Stack direction="row" spacing={3} mt={2}>
                  <Button colorScheme="yellow" onClick={() => openRiderEditModal(rider)}>
                    Edit
                  </Button>
                  <Button colorScheme="red" onClick={() => handleDeleteRider(rider.id!)}>
                    Delete
                  </Button>
                </Stack>
              )}
            </Box>
          
          ))
        ) : (
          <Text color="white">No interested riders yet.</Text>
        )}
          </SimpleGrid>
      </Box>

      {/* Edit Team Component (conditionally rendered if a team is selected for editing) */}
      {editMode && currentTeam && (
        <ZRLEditDelete
          team={currentTeam}
          onClose={closeEditModal} // Close modal function
        />
      )}

      {/* Edit Rider Component (conditionally rendered if a rider is selected for editing) */}
      {isRiderEditMode && currentRider && (
        <ZRLRiderEditDelete
          rider={currentRider} // Pass the current rider to edit
          onClose={closeRiderEditModal} // Close modal function for riders
        />
      )}
    </Box>
  );
};

export default ZRL;
