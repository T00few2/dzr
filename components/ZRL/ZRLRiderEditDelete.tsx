// ZRLRiderEditDelete.tsx

import { useState, useEffect } from 'react';
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
import { db } from '@/app/utils/firebaseConfig';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Rider {
  id?: string; // Optional ID for the rider
  userId: string; // Field to store the user ID of the rider
  name: string; // Rider's name
  division: string; // Rider's division
  rideTime: string; // Preferred race time
}

interface ZRLRiderEditDeleteProps {
  rider: Rider | null; // Allow rider to be null
  onClose: () => void;
}

const ZRLRiderEditDelete: React.FC<ZRLRiderEditDeleteProps> = ({ rider, onClose }) => {
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [rideTime, setRideTime] = useState('');

  // Update local state when rider changes
  useEffect(() => {
    if (rider) {
      setName(rider.name);
      setDivision(rider.division);
      setRideTime(rider.rideTime);
    }
  }, [rider]);

  const handleEditRider = async () => {
    if (!rider?.id) return;

    try {
      const riderRef = doc(db, 'riders', rider.id);
      await updateDoc(riderRef, {
        name,
        division,
        rideTime,
      });
      onClose(); // Close the modal after update
    } catch (error) {
      console.error('Error updating rider:', error);
    }
  };



  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="white">Edit Interested Rider</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="riderName" mb={4}>
            <FormLabel color="white">Rider Name</FormLabel>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter rider's name"
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
          <FormControl id="rideTime" mb={4}>
            <FormLabel color="white">Ride Time</FormLabel>
            <Input
              type="text"
              value={rideTime}
              onChange={(e) => setRideTime(e.target.value)}
              placeholder="Enter preferred race time"
              bg="white"
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleEditRider} isDisabled={!rider}>
            Update Interest
          </Button>
 
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ZRLRiderEditDelete;
