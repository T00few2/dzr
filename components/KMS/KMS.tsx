// components/KMS/KMS.tsx
import { useState, useEffect, useContext } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';

import { db } from '@/app/utils/firebaseConfig';
import { AuthContext } from '@/components/auth/AuthContext';

import {
  Box,
  Heading,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text
} from '@chakra-ui/react';

interface Signup {
  id: string;         // Firestore document ID
  uid: string;        // Firebase user UID
  displayName: string;
  zwiftID: string;
  currentRating?: number;
  max30Rating?: number;
  max90Rating?: number;
}

const KMS = () => {
  const { currentUser } = useContext(AuthContext);
  const [zwiftID, setZwiftID] = useState('');
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);

  // Fetch all signups on component mount
  useEffect(() => {
    const fetchSignups = async () => {
      setLoadingSignups(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'raceSignups'));
        const data: Signup[] = [];
        querySnapshot.forEach((docSnap) => {
          data.push({ id: docSnap.id, ...docSnap.data() } as Signup);
        });
        setSignups(data);
      } catch (error) {
        console.error('Error fetching signups: ', error);
      } finally {
        setLoadingSignups(false);
      }
    };

    fetchSignups();
  }, []);

  // Handle new signup
  const handleSignup = async () => {
    if (!currentUser) return;
    if (!zwiftID) {
      alert('Please enter your ZwiftID.');
      return;
    }

    // 1) Check if this user is already signed up (by uid)
    const alreadySignedUp = signups.some((signup) => signup.uid === currentUser.uid);
    if (alreadySignedUp) {
      alert('You have already signed up!');
      return;
    }

    try {
      // 2) Fetch rider data from the Zwift Ranking endpoint via your API route
      const response = await fetch(`/api/zr/${zwiftID}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch rider data. Status: ${response.status}`);
      }

      const riderData = await response.json();

      // 3) Extract the ratings we want to store
      const currentRating = riderData?.race?.current?.rating || 0;
      const max30Rating = riderData?.race?.max30?.rating || 0;
      const max90Rating = riderData?.race?.max90?.rating || 0;

      // 4) Create the signup object
      const newSignup: Omit<Signup, 'id'> = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'No Name',
        zwiftID,
        currentRating,
        max30Rating,
        max90Rating,
      };

      // 5) Save the signup to Firestore
      const docRef = await addDoc(collection(db, 'raceSignups'), newSignup);

      // 6) Update local state
      setSignups((prev) => [...prev, { ...newSignup, id: docRef.id }]);

      // 7) Clear the Zwift ID input
      setZwiftID('');
    } catch (error) {
      console.error('Error adding signup: ', error);
      alert('There was an error signing up. Please check the console for details.');
    }
  };

  // Delete a signup (only let user delete their own)
  const handleDelete = async (signupId: string, signupUid: string) => {
    if (!currentUser) return;
    if (currentUser.uid !== signupUid) {
      alert('You can only delete your own signup.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'raceSignups', signupId));
      // Remove from local state
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
    } catch (error) {
      console.error('Error deleting signup: ', error);
    }
  };

  return (
    <Box p={4} bg="gray.800" color="white">
      <Heading size="lg" mb={4}>
        Klubmesterskab tilmelding
      </Heading>

      {currentUser && (
        <>
          <Text mb={2}>Hej {currentUser.displayName || 'Unnamed User'}!</Text>
          <Box mb={4}>
            <Input
              placeholder="Indtast dit ZwiftID"
              value={zwiftID}
              onChange={(e) => setZwiftID(e.target.value)}
              mb={2}
            />
            <Button onClick={handleSignup} colorScheme="teal">
              Tilmeld
            </Button>
          </Box>
        </>
      )}

      <Heading size="md" mb={2}>
        Nuværende tilmeldinger
      </Heading>

      {loadingSignups ? (
        <Text>Loader tilmeldinger...</Text>
      ) : signups.length === 0 ? (
        <Text>Ingen tilmeldinger endnu.</Text>
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th color="white">Navn</Th>
              <Th color="white">ZwiftID</Th>
              <Th color="white">Current vELO Rating</Th>
              <Th color="white">Max 30d vELO Rating</Th>
              <Th color="white">Max 90d vELO Rating</Th>
              <Th color="white">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {signups.map((signup) => (
              <Tr key={signup.id}>
                <Td>{signup.displayName}</Td>
                <Td>{signup.zwiftID}</Td>
                <Td>{signup.currentRating}</Td>
                <Td>{signup.max30Rating}</Td>
                <Td>{signup.max90Rating}</Td>
                <Td>
                  <Button
                    size="sm"
                    colorScheme="red"
                    onClick={() => handleDelete(signup.id, signup.uid)}
                  >
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
};

export default KMS;
