// ZRLEditDelete.tsx

import { useState, useEffect } from 'react';
import { Button, FormControl, FormLabel, Input, Checkbox, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter } from '@chakra-ui/react';
import { db } from '@/app/utils/firebaseConfig'; 
import { doc, updateDoc } from 'firebase/firestore';
import SendMessage from '../discord-bot/SendMessage';

interface Team {
  id?: string;
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
  lookingForRiders?: boolean; // New field
}

interface ZRLEditDeleteProps {
  team: Team | null; // Allow team to be null
  onClose: () => void;
}

const ZRLEditDelete: React.FC<ZRLEditDeleteProps> = ({ team, onClose }) => {
  const [newTeamName, setNewTeamName] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [division, setDivision] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [lookingForRiders, setLookingForRiders] = useState(false); // New state for checkbox

  // Update local state when team changes
  useEffect(() => {
    if (team) {
      setNewTeamName(team.name);
      setRideTime(team.rideTime);
      setDivision(team.division);
      setCaptainName(team.captainName);
      setLookingForRiders(team.lookingForRiders || false); // Set initial checkbox value
    }
  }, [team]);

  const handleEditTeam = async () => {
    if (!team?.id) return;

    // Regular expression to match HH:MM format (24-hour clock)
    const timeFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeFormat.test(rideTime)) {
      alert('Brug venligst formatet HH:MM for Race Time');
      return;
    }

    try {
      const teamRef = doc(db, 'teams', team.id);
      await updateDoc(teamRef, {
        name: newTeamName,
        rideTime,
        division,
        captainName,
        lookingForRiders, // Save the checkbox value
      });
      onClose();
      if (lookingForRiders) {
        const messageContent = '🚨BREAKING🚨\n\n@everyone\n\n' + newTeamName + " leder efter nye ryttere.\n" + newTeamName + ' kører i ' + division + ' klokken ' + rideTime + '.\nKontakt holdkaptajn ' + captainName + '.';
        await SendMessage('1297934562558611526', messageContent);
      }
   
    } catch (error) {
      console.error('Error updating team:', error);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="white">Edit Team</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
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
          <FormControl id="rideTime" mb={4}>
            <FormLabel color="white">Ride Time</FormLabel>
            <Input
              type="text"
              value={rideTime}
              onChange={(e) => setRideTime(e.target.value)}
              placeholder="Enter ride time"
              bg="white"
            />
          </FormControl>
          <FormControl id="division" mb={4}>
            <FormLabel color="white">Division</FormLabel>
            <Input
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="Enter division (A, B, C, or D)"
              bg="white"
            />
          </FormControl>
          <FormControl id="lookingForRiders" mb={4}>
            <Checkbox
              isChecked={lookingForRiders}
              onChange={(e) => setLookingForRiders(e.target.checked)}
            >
              Looking for riders
            </Checkbox>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleEditTeam} isDisabled={!team}>
            Update Team
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ZRLEditDelete;
