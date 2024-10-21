import { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
} from '@chakra-ui/react';
import { auth, db } from '@/app/utils/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

interface Team {
  name: string;
  captainId: string;
  captainName: string;
  createdAt: string;
  rideTime: string;
  division: string;
}

const ZRLRegister = () => {
  const [newTeamName, setNewTeamName] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [division, setDivision] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleTeamRegister = async () => {
    if (!newTeamName || !auth.currentUser || !rideTime || !division) return;

    try {
      const teamData: Team = {
        name: newTeamName,
        captainId: auth.currentUser.uid,
        captainName: captainName || auth.currentUser.displayName || 'Unknown',
        createdAt: new Date().toISOString(),
        rideTime,
        division,
      };

      await addDoc(collection(db, 'teams'), teamData);
      resetForm();
    } catch (error) {
      console.error('Error registering team:', error);
    }
  };

  const resetForm = () => {
    setNewTeamName('');
    setRideTime('');
    setDivision('');
    setCaptainName('');
    setIsOpen(false);
  };

  const openRegisterModal = () => {
    setCaptainName(auth.currentUser?.displayName || '');
    setIsOpen(true);
  };

  return (
    <Box>
      <Button whiteSpace="nowrap" mt={4} colorScheme="blue" variant='outline' onClick={openRegisterModal}>
        Registrer Team
      </Button>
      <Modal isOpen={isOpen} onClose={resetForm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader >Register a New Team</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="teamName" mb={4}>
              <FormLabel >Team Name</FormLabel>
              <Input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                bg="white"
              />
            </FormControl>
            <FormControl id="captainName" mb={4}>
              <FormLabel >Captain Name</FormLabel>
              <Input
                type="text"
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                placeholder="Enter captain's name"
                bg="white"
              />
            </FormControl>
            <FormControl id="rideTime" mb={4}>
              <FormLabel >Race Time</FormLabel>
              <Input
                type="text"
                value={rideTime}
                onChange={(e) => setRideTime(e.target.value)}
                placeholder="Enter race time"
                bg="white"
              />
            </FormControl>
            <FormControl id="division" mb={4}>
              <FormLabel >Division</FormLabel>
              <Input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="Enter division (A, B, C, or D)"
                bg="white"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={handleTeamRegister}>
              Register Team
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ZRLRegister;