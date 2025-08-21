// ZRLEditDelete.tsx
import { useState, useEffect } from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Select,
} from '@chakra-ui/react';
import { db } from '@/app/utils/firebaseConfig'; 
import { doc, updateDoc } from 'firebase/firestore';
import SendMessage from '../discord-bot/SendMessage';
import { useSession } from 'next-auth/react';

interface Team {
  id?: string;
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
  raceSeries?: string;              // <-- New field for the series
  lookingForRiders?: boolean;       // Existing field
}

interface ZRLEditDeleteProps {
  team: Team | null;
  onClose: () => void;
}

const ZRLEditDelete: React.FC<ZRLEditDeleteProps> = ({ team, onClose }) => {
  const { data: session } = useSession();
  const [newTeamName, setNewTeamName] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [division, setDivision] = useState('');
  const [raceSeries, setRaceSeries] = useState('');  // <-- State for the Race Series
  const [captainName, setCaptainName] = useState('');
  const [lookingForRiders, setLookingForRiders] = useState(false);

  // Map each race series to its possible divisions
  const divisionsMap: { [key: string]: string[] } = {
    'WTRL ZRL': [
      'A1','A2','A3',
      'B1','B2','B3',
      'C1','C2','C3',
      'D1','D2','D3',
    ],
    'WTRL TTT': ['Doppio', 'Espresso', 'Frappe', 'Latte', 'Mocha'],
    'DRS': [
      'Diamond','Ruby','Emerald','Sapphire','Amethyst',
      'Gold','Bronze','Platinum','Silver'
    ],
    'Club Ladder': [],
  };

  // Get the divisions for the selected race series
  const availableDivisions = divisionsMap[raceSeries] || [];

  useEffect(() => {
    if (team) {
      setNewTeamName(team.name);
      setRideTime(team.rideTime);
      setDivision(team.division);
      setCaptainName(team.captainName);
      setLookingForRiders(team.lookingForRiders || false);
      // If raceSeries is missing in the DB, default to empty string
      setRaceSeries(team.raceSeries || '');
    }
  }, [team]);

  const handleEditTeam = async () => {
    if (!team?.id) return;

    // Validate Ride Time (HH:MM 24h)
    const value = (rideTime || '').trim();
    const timeFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeFormat.test(value)) {
      alert('Please use the HH:MM format for Race Time');
      return;
    }

    // If it's not Club Ladder, we expect a non-empty division
    if (raceSeries !== 'Club Ladder' && !division) {
      alert('Please select a division.');
      return;
    }

    try {
      const teamRef = doc(db, 'teams', team.id);
      await updateDoc(teamRef, {
        name: newTeamName,
        rideTime: value,
        division: raceSeries === 'Club Ladder' ? '' : division,
        raceSeries,           // <-- Update Firestore with Race Series
        captainName,
        lookingForRiders,
      });

      onClose();

      // If the team is looking for riders, send Discord message
      if (lookingForRiders) {
        const captainDiscordId = (session?.user as any)?.discordId as string | undefined;
        const captainDisplay = captainDiscordId ? `<@${captainDiscordId}>` : captainName;
        const messageContent = 
          '🚨BREAKING🚨\n\n' +
          '@everyone\n\n' +
          `${newTeamName} leder efter nye ryttere.\n` +
          `${newTeamName} kører ${raceSeries} i ${division} klokken ${value}.\n` +
          `Kontakt holdkaptajn ${captainDisplay}.`;
        
        await SendMessage('1297934562558611526', messageContent, {
          userIds: captainDiscordId ? [captainDiscordId] : [],
          mentionEveryone: true,
        });
      }
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="black">Edit Team</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/* Team Name */}
          <FormControl id="teamName" mb={4}>
            <FormLabel color="white">Team Name</FormLabel>
            <Input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team name"
              bg="white"
            />
          </FormControl>

          {/* Captain Name */}
          <FormControl id="captainName" mb={4}>
            <FormLabel color="white">Captain Name</FormLabel>
            <Input
              type="text"
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              placeholder="Enter captain's name"
              bg="white"
            />
          </FormControl>

          {/* Ride Time */}
          <FormControl id="rideTime" mb={4}>
            <FormLabel color="white">Ride Time</FormLabel>
            <Input
              type="text"
              value={rideTime}
              onChange={(e) => setRideTime(e.target.value)}
              placeholder="HH:MM"
              bg="white"
            />
          </FormControl>

          {/* Race Series */}
          <FormControl id="raceSeries" mb={4}>
            <FormLabel color="white">Race Series</FormLabel>
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

          {/* Division - only if not Club Ladder */}
          {raceSeries !== 'Club Ladder' && (
            <FormControl id="division" mb={4}>
              <FormLabel color="white">Division</FormLabel>
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

          {/* Looking for Riders Checkbox */}
          <FormControl id="lookingForRiders" mb={4}>
            <Checkbox
              isChecked={lookingForRiders}
              onChange={(e) => setLookingForRiders(e.target.checked)}
              color="black"
            >
              Looking for riders
            </Checkbox>
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            onClick={handleEditTeam}
            isDisabled={!team}
          >
            Update Team
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ZRLEditDelete;
