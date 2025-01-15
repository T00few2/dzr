// components/KMS/KMS.tsx

import { useState, useEffect, useContext, useRef } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
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
  id: string;
  uid: string;
  displayName: string;
  zwiftID: string;
  currentRating?: number;
  max30Rating?: number;
  max90Rating?: number;
  group?: number; // 1..5
  phenotypeValue?: string; 
}

interface GroupedData {
  group1: { zwift_id: number; ranking: number }[];
  group2: { zwift_id: number; ranking: number }[];
  group3: { zwift_id: number; ranking: number }[];
  group4: { zwift_id: number; ranking: number }[];
  group5: { zwift_id: number; ranking: number }[];
}

const KMS = () => {
  const { currentUser } = useContext(AuthContext);

  const [zwiftID, setZwiftID] = useState('');
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);

  // We'll store the previous signups in a ref, so we can compare doc IDs
  const prevSignupsRef = useRef<Signup[]>([]);

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
        console.error('Error fetching signups:', error);
      } finally {
        setLoadingSignups(false);
      }
    };

    fetchSignups();
  }, []);

  // Only re-group if there's a doc in `signups` not present in `prevSignupsRef`
  useEffect(() => {
    if (signups.length === 0) return;

    // Build sets of doc IDs for old and new signups
    const oldIDs = new Set(prevSignupsRef.current.map((s) => s.id));
    const newIDs = new Set(signups.map((s) => s.id));

    // Check if there's at least one new ID
    const foundNewDoc = Array.from(newIDs).some((id) => !oldIDs.has(id));
    if (foundNewDoc) {
      // We found a new signup doc => run grouping
      groupSignups();
    }

    // Update our ref so we remember these signups
    prevSignupsRef.current = signups;
  }, [signups]);

  const groupSignups = async () => {
    // Build the payload for groupByVELO
    const ridersPayload = signups.map((s) => ({
      zwift_id: parseInt(s.zwiftID, 10),
      ranking: s.currentRating ?? 0
    }));

    try {
      // Call your groupByVELO endpoint (API Gateway)
      const response = await fetch(
        'https://gijpv4f7xe.execute-api.eu-north-1.amazonaws.com/prod/ranking',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riders: ridersPayload })
        }
      );
      if (!response.ok) {
        throw new Error(`Error grouping signups: ${response.status}`);
      }

      const groupedData: GroupedData = await response.json();
      // 2. Update Firestore with group info
      await updateGroupsInFirestore(groupedData);

      // 3. Optionally refetch or just patch local state if you want to see group changes
      // We'll do a quick refetch to see the newly-updated group fields:
      await refetchSignups();
    } catch (err) {
      console.error('Failed to group signups:', err);
    }
  };

  // Helper function to update each doc in Firestore with `group`
  const updateGroupsInFirestore = async (groupedData: GroupedData) => {
    await Promise.all([
      ...groupedData.group1.map((rider) => setGroupForRider(rider.zwift_id, 1)),
      ...groupedData.group2.map((rider) => setGroupForRider(rider.zwift_id, 2)),
      ...groupedData.group3.map((rider) => setGroupForRider(rider.zwift_id, 3)),
      ...groupedData.group4.map((rider) => setGroupForRider(rider.zwift_id, 4)),
      ...groupedData.group5.map((rider) => setGroupForRider(rider.zwift_id, 5))
    ]);
  };

  // Helper to update a single doc in Firestore
  const setGroupForRider = async (zwiftId: number, groupNumber: number) => {
    // 1) Find the doc in our `signups` array
    const signupDoc = signups.find(
      (s) => parseInt(s.zwiftID, 10) === zwiftId
    );
    if (!signupDoc) return;

    // 2) Update Firestore doc
    const docRef = doc(db, 'raceSignups', signupDoc.id);
    await updateDoc(docRef, { group: groupNumber });
  };

  const refetchSignups = async () => {
    setLoadingSignups(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'raceSignups'));
      const data: Signup[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() } as Signup);
      });
      setSignups(data);
    } catch (error) {
      console.error('Error refetching signups:', error);
    } finally {
      setLoadingSignups(false);
    }
  };

  // Handle new signup
  const handleSignup = async () => {
    if (!currentUser) return;
    if (!zwiftID) {
      alert('Please enter your ZwiftID.');
      return;
    }

    const alreadySignedUp = signups.some(
      (signup) => signup.uid === currentUser.uid
    );
    if (alreadySignedUp) {
      alert('You have already signed up!');
      return;
    }

    try {
      // Fetch from your /api/zr/ endpoint
      const response = await fetch(`/api/zr/${zwiftID}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch rider data. Status: ${response.status}`);
      }

      const riderData = await response.json();

      const currentRating = riderData?.race?.current?.rating || 0;
      const max30Rating = riderData?.race?.max30?.rating || 0;
      const max90Rating = riderData?.race?.max90?.rating || 0;
      const phenotypeValue = riderData?.phenotype?.value || 'Unknown';

      const newSignup: Omit<Signup, 'id'> = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'No Name',
        zwiftID,
        currentRating,
        max30Rating,
        max90Rating,
        phenotypeValue,
      };

      // Add the doc to Firestore
      const docRef = await addDoc(collection(db, 'raceSignups'), newSignup);

      // Update local state
      setSignups((prev) => [...prev, { ...newSignup, id: docRef.id }]);
      setZwiftID('');
    } catch (error) {
      console.error('Error adding signup:', error);
      alert('There was an error signing up. Please check the console for details.');
    }
  };

  // Delete
  const handleDelete = async (signupId: string, signupUid: string) => {
    if (!currentUser) return;
    if (currentUser.uid !== signupUid) {
      alert('You can only delete your own signup.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'raceSignups', signupId));
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
    } catch (error) {
      console.error('Error deleting signup:', error);
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
                <Th color="white" textAlign={'center'}>Current vELO Rating</Th>
                <Th color="white">Group</Th>
                <Th color="white">Phenotype</Th>
                <Th color="white">Actions</Th>
                </Tr>
            </Thead>
            <Tbody>
                {signups.map((signup) => (
                <Tr key={signup.id}>
                    <Td>{signup.displayName}</Td>
                    <Td>{signup.zwiftID}</Td>
                    {/* Round currentRating to an integer */}
                    <Td textAlign={'center'}>{Math.round(signup.currentRating || 0)}</Td>
                    <Td>{signup.group || 'N/A'}</Td>
                    <Td>{signup.phenotypeValue ?? 'N/A'}</Td>
                    {/* Conditionally show the "Delete" button */}
                    <Td>
                    {currentUser?.uid === signup.uid && (
                        <Button
                        size="sm"
                        colorScheme="red"
                        onClick={() => handleDelete(signup.id, signup.uid)}
                        >
                        Delete
                        </Button>
                    )}
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
