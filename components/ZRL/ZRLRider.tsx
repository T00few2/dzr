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
import SendMessage from '../discord-bot/SendMessage';

interface Rider {
  id?: string; // Optional ID for the rider
  userId: string; // Field to store the user ID of the rider
  name: string; // Rider's name
  division: string; // Rider's division
  rideTime: string; // Preferred race time
}

const ZRLRider = () => {
  const [name, setName] = useState(auth.currentUser?.displayName || ''); // Default to user's display name
  const [division, setDivision] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleRegisterInterest = async () => {
    if (!rideTime || !auth.currentUser || !division) return;

    try {
      const riderData: Rider = {
        userId: auth.currentUser.uid,
        name,
        division,
        rideTime,
      };

      await addDoc(collection(db, 'riders'), riderData)
      
      const roleId = '1195878349617250405'
      const messageContent = `🚴 Ny rytter i gården 🚴\n\n${name} er på fri transfer.\nKører gerne ${division} klokken ${rideTime}.\nAttention <@&${roleId}>`
      resetForm();
      await SendMessage('1297934562558611526', messageContent)
    
    } catch (error) {
      console.error('Error registering interest:', error)
    }
  };

  const resetForm = () => {
    setName(auth.currentUser?.displayName || ''); // Reset name to display name
    setDivision('');
    setRideTime('');
    setIsOpen(false);
  };

  const openRegisterModal = () => {
    setIsOpen(true);
  };

  return (
    <Box>
      <Button mt={4} mb={4} colorScheme="purple" variant='outline' onClick={openRegisterModal}>
        Efterspørg Team
      </Button>
      <Modal isOpen={isOpen} onClose={resetForm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Register Interest</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="name" mb={4}>
              <FormLabel>Name</FormLabel>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                bg="white"
              />
            </FormControl>
            <FormControl id="division" mb={4}>
              <FormLabel>Preferred Division</FormLabel>
              <Input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="Enter division (eg. A1-A2, C3, D2, ...)"
                bg="white"
              />
            </FormControl>
            <FormControl id="rideTime" mb={4}>
              <FormLabel>Preferred Race Time</FormLabel>
              <Input
                type="text"
                value={rideTime}
                onChange={(e) => setRideTime(e.target.value)}
                placeholder="Enter preferred race time (eg. 19:15-20:00)"
                bg="white"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={handleRegisterInterest}>
              Register Interest
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

export default ZRLRider;
