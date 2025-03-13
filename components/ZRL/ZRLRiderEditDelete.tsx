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
  Select,
} from '@chakra-ui/react';
import { db } from '@/app/utils/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

interface Rider {
  id?: string;       // Optional ID for the rider
  userId: string;    // Field to store the user ID of the rider
  name: string;      // Rider's name
  division: string;  // Rider's division (free text)
  rideTime: string;  // Preferred race time
  raceSeries?: string; // Optional field for Race Series
}

interface ZRLRiderEditDeleteProps {
  rider: Rider | null; // Allow rider to be null
  onClose: () => void;
}

const ZRLRiderEditDelete: React.FC<ZRLRiderEditDeleteProps> = ({ rider, onClose }) => {
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [raceSeries, setRaceSeries] = useState(''); // New state for race series

  // Populate local state when rider changes
  useEffect(() => {
    if (rider) {
      setName(rider.name);
      setDivision(rider.division);
      setRideTime(rider.rideTime);
      // If raceSeries is missing, default to empty string
      setRaceSeries(rider.raceSeries || '');
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
        raceSeries, // Update the new raceSeries field
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
        {/* Remove color="white" so it defaults to black text */}
        <ModalHeader>Edit Interested Rider</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="riderName" mb={4}>
            <FormLabel>Rider Name</FormLabel>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter rider's name"
              bg="white"
            />
          </FormControl>

          {/* Race Series Dropdown */}
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

          <FormControl id="division" mb={4}>
            <FormLabel>Division</FormLabel>
            <Input
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="Enter division (e.g., A1, B2, etc.)"
              bg="white"
            />
          </FormControl>

          <FormControl id="rideTime" mb={4}>
            <FormLabel>Ride Time</FormLabel>
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

          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ZRLRiderEditDelete;
