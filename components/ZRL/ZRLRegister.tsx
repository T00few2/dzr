import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  FormHelperText,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Select,
} from '@chakra-ui/react';
import { auth, db } from '@/app/utils/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { useSession } from 'next-auth/react';
import SendMessage from '../discord-bot/SendMessage';

interface Team {
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
  raceSeries: string;
  teamRoleId: string;
}

const ZRLRegister = () => {
  const { data: session } = useSession();
  const [newTeamName, setNewTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [division, setDivision] = useState('');
  const [raceSeries, setRaceSeries] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [teamRoleId, setTeamRoleId] = useState('');

  // Map each race series to its possible divisions
  // (Empty array for "Club Ladder" means no division)
  const divisionsMap: { [key: string]: string[] } = {
    'WTRL ZRL': [
      'A1','A2','A3',
      'B1','B2','B3',
      'C1','C2','C3',
      'D1','D2','D3',
    ],
    'WTRL TTT': ['Doppio', 'Espresso', 'Frappe', 'Latte', 'Mocha'],
    'DRS': ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Amethyst', 'Gold', 'Bronze', 'Platinum', 'Silver'],
    'Club Ladder': [],
  };

  // Dynamically get the list of divisions based on the selected raceSeries
  const availableDivisions = divisionsMap[raceSeries] || [];

  const prefillCaptainName = async () => {
    try {
      const res = await fetch('/api/members/real-name');
      if (res.ok) {
        const data = await res.json();
        setCaptainName(data?.displayName || auth.currentUser?.displayName || '');
        return;
      }
    } catch (_) {}
    setCaptainName(auth.currentUser?.displayName || '');
  };

  const openRegisterModal = () => {
    prefillCaptainName();
    setIsOpen(true);
  };

  const resetForm = () => {
    setNewTeamName('');
    setCaptainName('');
    setRideTime('');
    setDivision('');
    setRaceSeries('');
    setTeamRoleId('');
    setIsOpen(false);
  };

  const handleTeamRegister = async () => {
    const timeValue = (rideTime || '').trim();

    if (!newTeamName || !auth.currentUser || !timeValue || !raceSeries || !teamRoleId) {
      alert('Please fill in all required fields.');
      return;
    }

    // Validate teamRoleId (Discord role id – numeric string)
    const roleIdOk = /^[0-9]{15,21}$/.test(teamRoleId.trim());
    if (!roleIdOk) {
      alert('Please enter a valid Discord team role ID (numbers only).');
      return;
    }

    if (raceSeries !== 'Club Ladder' && !division) {
      alert('Please select a division.');
      return;
    }

    const timeFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeFormat.test(timeValue)) {
      alert('Please use the HH:MM format for Race Time');
      return;
    }

    try {
      const teamData: Team = {
        name: newTeamName,
        captainId: auth.currentUser.uid,
        captainName: captainName || auth.currentUser.displayName || 'Unknown',
        createdAt: new Date().toISOString(),
        rideTime: timeValue,
        division: raceSeries === 'Club Ladder' ? '' : division,
        raceSeries,
        teamRoleId: teamRoleId.trim(),
      };

      await addDoc(collection(db, 'teams'), teamData);

      // Notify Discord channel, tagging the captain (the current session user)
      const captainDiscordId = (session?.user as any)?.discordId as string | undefined;
      const captainDisplay = captainDiscordId ? `<@${captainDiscordId}>` : (teamData.captainName || 'Captain');
      const messageContent = `🆕 Nyt team registreret\n\n**${teamData.name}** er registreret i ${teamData.raceSeries}${teamData.division ? `, division ${teamData.division}` : ''}.\nRace time: ${teamData.rideTime}.\nHoldkaptajn: ${captainDisplay}`;
      await SendMessage('1297934562558611526', messageContent, {
        userIds: captainDiscordId ? [captainDiscordId] : [],
      });

      resetForm();
    } catch (error) {
      console.error('Error registering team:', error);
    }
  };

  return (
    <Box>
      <Button
        whiteSpace="nowrap"
        mt={4}
        colorScheme="blue"
        variant="outline"
        onClick={openRegisterModal}
      >
        Registrer Team
      </Button>

      <Modal isOpen={isOpen} onClose={resetForm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Register a New Team</ModalHeader>
          <ModalCloseButton color="rgba(173, 26, 45, 0.95)" _hover={{ bg: 'rgba(173, 26, 45, 0.10)' }} />
          <ModalBody>
            <FormControl id="teamName" mb={4}>
              <FormLabel>Team Name</FormLabel>
              <Input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                bg="white"
              />
            </FormControl>

            <FormControl id="captainName" mb={4}>
              <FormLabel>Captain Name</FormLabel>
              <Input
                type="text"
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                placeholder="Enter captain's name"
                bg="white"
              />
            </FormControl>

            {/* Team Role ID (Discord) */}
            <FormControl id="teamRoleId" mb={4} isRequired>
              <FormLabel>Team Role ID (Discord)</FormLabel>
              <Input
                type="text"
                value={teamRoleId}
                onChange={(e) => setTeamRoleId(e.target.value)}
                placeholder="Ask an admin for your team role ID (numbers only)"
                bg="white"
              />
              <FormHelperText>
                You need the Discord role ID for your team. Ask a Discord admin.
              </FormHelperText>
            </FormControl>

            {/* New Race Series field */}
            <FormControl id="raceSeries" mb={4}>
              <FormLabel>Race Series</FormLabel>
              <Select
                placeholder="Select race series"
                value={raceSeries}
                onChange={(e) => setRaceSeries(e.target.value)}
                bg="white"
              >
                <option value="WTRL ZRL">WTRL ZRL</option>
                <option value="WTRL TTT">WTRL TTT</option>
                <option value="DRS">DRS</option>
                <option value="Club Ladder">Club Ladder</option>
              </Select>
            </FormControl>

            {/* Division field only appears if raceSeries != "Club Ladder" */}
            {raceSeries !== 'Club Ladder' && (
              <FormControl id="division" mb={4}>
                <FormLabel>Division</FormLabel>
                <Select
                  placeholder="Select division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  bg="white"
                >
                  {availableDivisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </Select>
              </FormControl>
            )}
            
            <FormControl id="rideTime" mb={4}>
              <FormLabel>Race Time</FormLabel>
              <Input
                type="text"
                value={rideTime}
                onChange={(e) => setRideTime(e.target.value)}
                placeholder="Enter race time (HH:MM)"
                bg="white"
              />
            </FormControl>
            
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" onClick={handleTeamRegister}>
              Register Team
            </Button>
            <Button
              background="rgba(173, 26, 45, 0.95)"
              color={'white'}
              _hover={{ background: 'rgba(173, 26, 45, 1)' }}
              onClick={resetForm}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ZRLRegister;
