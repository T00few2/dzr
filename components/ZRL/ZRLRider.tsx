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
  Select,
} from '@chakra-ui/react';
import { auth, db } from '@/app/utils/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import SendMessage from '../discord-bot/SendMessage';
import { useSession } from 'next-auth/react';

interface Rider {
  id?: string;
  userDiscordId: string;
  name: string;
  division: string;
  rideTime: string;
  raceSeries: string; // new
  expiresAt?: Date;   // new
}

const ZRLRider = () => {
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [rideTime, setRideTime] = useState('');
  const [raceSeries, setRaceSeries] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const prefillName = async () => {
    try {
      const res = await fetch('/api/members/real-name');
      if (res.ok) {
        const data = await res.json();
        setName(data?.displayName || auth.currentUser?.displayName || '');
        return;
      }
    } catch (_) {}
    setName(auth.currentUser?.displayName || '');
  };

  const openRegisterModal = () => {
    setIsOpen(true);
    prefillName();
  };

  const resetForm = () => {
    setName(auth.currentUser?.displayName || '');
    setDivision('');
    setRideTime('');
    setRaceSeries('');
    setIsOpen(false);
  };

  const handleRegisterInterest = async () => {
    // Basic validation
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!rideTime || !discordId || !division || !raceSeries) {
      alert('Please complete all fields before submitting.');
      return;
    }

    // Let the registration expire in 21 days
    const expiresAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

    try {
      const riderData: Rider = {
        userDiscordId: discordId,
        name,
        division,
        rideTime,
        raceSeries,
        expiresAt, // We'll use this in Firestore TTL
      };

      // Add the new rider doc to Firestore
      await addDoc(collection(db, 'riders'), riderData);

      // Post a message to Discord
      const roleId = '1195878349617250405';
      const riderDisplay = discordId ? `<@${discordId}>` : name;
      const messageContent = `🚴 Ny rytter i gården 🚴\n\n${riderDisplay} er på fri transfer i ${raceSeries}.\nKører gerne ${division} klokken ${rideTime}.\nAttention <@&${roleId}>`;

      await SendMessage('1297934562558611526', messageContent, {
        userIds: discordId ? [discordId] : [],
      });
      resetForm();

    } catch (error) {
      console.error('Error registering rider:', error);
    }
  };

  return (
    <Box>
      <Button
        mt={4}
        mb={4}
        colorScheme="purple"
        variant="outline"
        onClick={openRegisterModal}
      >
        Efterspørg Team
      </Button>

      <Modal isOpen={isOpen} onClose={resetForm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Register Interest</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* Rider Name */}
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

            {/* Race Series (Dropdown) */}
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

            {/* Division (Free text) */}
            <FormControl id="division" mb={4}>
              <FormLabel>Preferred Division</FormLabel>
              <Input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="Enter your division (e.g., A1, B2, etc.)"
                bg="white"
              />
            </FormControl>

            {/* Race Time (Free text) */}
            <FormControl id="rideTime" mb={4}>
              <FormLabel>Preferred Race Time</FormLabel>
              <Input
                type="text"
                value={rideTime}
                onChange={(e) => setRideTime(e.target.value)}
                placeholder="Enter preferred race time (e.g., 19:15)"
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
