// components/KMS/KMS.tsx

import { useState, useEffect, useContext } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  writeBatch // Import writeBatch
} from 'firebase/firestore';

import { db } from '@/app/utils/firebaseConfig';
import { AuthContext } from '@/components/auth/AuthContext';

import {
  Box,Heading,Input,Button,Table,Thead, TableContainer,Tbody,InputGroup, Link,
  Tr,
  Th,
  Td,
  Text,
  Spinner,
  useToast,
  Container
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons'
import { Signup } from '@/app/types/Signup'; // Importing Signup interface

interface GroupedData {
  riders: { zwift_id: number; ranking: number; group: number }[]; // Ensure group is a number
}

const KMS = () => {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast(); // Initialize toast

  const [zwiftID, setZwiftID] = useState('');
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [processing, setProcessing] = useState(false); // To handle processing state

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
        toast({
          title: 'Fejl ved hentning af tilmeldinger',
          description: 'Der opstod en fejl under hentning af tilmeldinger. Prøv igen senere.',
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
      } finally {
        setLoadingSignups(false);
      }
    };

    fetchSignups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Assigns groups to signups based on their currentRating via external API.
   * @returns Promise<void>
   */
  const groupSignups = async () => {
    setProcessing(true);
    try {
      // 1. Fetch the latest signups from Firestore
      const querySnapshot = await getDocs(collection(db, 'raceSignups'));
      const latestSignups: Signup[] = [];
      querySnapshot.forEach((docSnap) => {
        latestSignups.push({ id: docSnap.id, ...docSnap.data() } as Signup);
      });

      if (latestSignups.length === 0) {
        console.warn('No signups available for grouping.');
        toast({
          title: 'Ingen tilmeldinger at gruppere.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
          position: 'top-right',
        });
        setProcessing(false);
        return;
      }

      // 2. Build the payload for groupByVELO
      const ridersPayload = latestSignups.map((s) => ({
        zwift_id: parseInt(s.zwiftID, 10),
        ranking: s.currentRating ?? 0
      }));

      // 3. Call your groupByVELO endpoint (API Gateway)
      const response = await fetch(
        'https://gijpv4f7xe.execute-api.eu-north-1.amazonaws.com/prod/ranking',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riders: ridersPayload })
        }
      );

      if (!response.ok) {
        throw new Error(`Error grouping signups: ${response.status} ${response.statusText}`);
      }

      const groupedData: GroupedData = await response.json();

      console.log(`Received group assignments for ${groupedData.riders.length} riders.`);

      // 4. Update Firestore with group assignments
      await updateGroupsInFirestore(groupedData, latestSignups);

      // 5. Refetch signups to update local state
      await refetchSignups();

      // Show success toast
      toast({
        title: 'Gruppeinddeling opdateret!',
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } catch (err) {
      console.error('Failed to group signups:', err);
      toast({
        title: 'Fejl ved gruppering',
        description: err instanceof Error ? err.message : 'Ukendt fejl',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Updates Firestore with the assigned groups for each rider.
   * @param groupedData - The grouped data received from the external API.
   * @param latestSignups - The latest signups fetched from Firestore.
   */
  const updateGroupsInFirestore = async (groupedData: GroupedData, latestSignups: Signup[]) => {
    const groupBatch = writeBatch(db); // Correct usage with writeBatch
    let updatedGroupCount = 0;

    groupedData.riders.forEach((rider) => {
      const signup = latestSignups.find((s) => parseInt(s.zwiftID, 10) === rider.zwift_id);
      if (signup) {
        const docRef = doc(db, 'raceSignups', signup.id);
        groupBatch.set(docRef, { group: rider.group }, { merge: true });
        updatedGroupCount++;
      } else {
        console.warn(`No matching signup found for ZwiftID=${rider.zwift_id}.`);
      }
    });

    if (updatedGroupCount > 0) {
      await groupBatch.commit();
      console.log(`Committed group assignments for ${updatedGroupCount} signups.`);
    } else {
      console.warn('No group assignments were updated.');
    }
  };

  /**
   * Refetches signups from Firestore to update the local state.
   * @returns Promise<void>
   */
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
      toast({
        title: 'Fejl ved opdatering af tilmeldinger',
        description: 'Der opstod en fejl under opdatering af tilmeldinger. Prøv igen senere.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setLoadingSignups(false);
    }
  };

  // Handle new signup
  const handleSignup = async () => {
    if (!currentUser) return;
    if (!zwiftID) {
      toast({
        title: 'Manglende ZwiftID',
        description: 'Vær venlig at indtaste dit ZwiftID.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      return;
    }

    const alreadySignedUp = signups.some(
      (signup) => signup.uid === currentUser.uid
    );
    if (alreadySignedUp) {
      toast({
        title: 'Tilmelding allerede foretaget',
        description: 'Du har allerede tilmeldt dig!',
        status: 'info',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      return;
    }

    try {
      setProcessing(true);
      // Fetch from your /api/zr/ endpoint
      const response = await fetch(`/api/zr/rider/${zwiftID}`);
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

      // Trigger group assignments after successful signup
      await groupSignups();
    } catch (error) {
      console.error('Error adding signup:', error);
      toast({
        title: 'Fejl ved tilmelding',
        description: 'Der opstod en fejl under tilmelding. Prøv igen senere.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle deletion
  const handleDelete = async (signupId: string, signupUid: string) => {
    if (!currentUser) return;
    if (currentUser.uid !== signupUid) {
      toast({
        title: 'Adgang nægtet',
        description: 'Du kan kun slette dine egne tilmeldinger.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      return;
    }

    try {
      setProcessing(true);
      await deleteDoc(doc(db, 'raceSignups', signupId));
      setSignups((prev) => prev.filter((s) => s.id !== signupId));

      // Trigger group assignments after successful deletion
      await groupSignups();
    } catch (error) {
      console.error('Error deleting signup:', error);
      toast({
        title: 'Fejl ved sletning',
        description: 'Der opstod en fejl under sletning af din tilmelding. Prøv igen senere.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container maxW={{base: '90%', md: '5xl'}} py={0} mb={20} color={'white'}>
      <Heading size="lg" mb={4}>
        Klubmesterskab tilmelding
      </Heading>

      {currentUser && (
        <>
          <Text mb={2}>Hej {currentUser.displayName || 'Unnamed User'}!</Text>
          <Box mb={4}>
      {signups.some((signup) => signup.uid === currentUser.uid) ? (
        // User is signed up
        <Box display="flex" alignItems="center">
          <Text>Du er tilmeldt</Text>
          <Button
            size="sm"
            colorScheme="red"
            ml={4}
            onClick={() => {
              const signup = signups.find((s) => s.uid === currentUser.uid);
              if (signup) {
                handleDelete(signup.id, signup.uid);
              }
            }}
            isLoading={processing}
          >
            Afmeld
          </Button>
        </Box>
      ) : (
        // User is not signed up
        <InputGroup size="md">
          <Input
            width="xs"
            placeholder="Indtast dit ZwiftID"
            value={zwiftID}
            onChange={(e) => setZwiftID(e.target.value)}
            mb={2}
            mr={2}
          />
          <Button onClick={handleSignup} colorScheme="teal" isLoading={processing}>
            Tilmeld
          </Button>
        </InputGroup>
      )}
    </Box>
        </>
      )}

      <Heading size="md" mb={2}>
        Nuværende tilmeldinger
      </Heading>

      {loadingSignups ? (
        <Spinner color="teal.500" />
      ) : signups.length === 0 ? (
        <Text>Ingen tilmeldinger endnu.</Text>
      ) : (
        <TableContainer  textAlign="center">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th color="white">Navn</Th>
              <Th color="white">Phenotype</Th>
              <Th color="white" textAlign={'center'}>Current vELO Rating</Th>
              <Th color="white" textAlign={'center'}>Max 30 day vELO Rating</Th>
              <Th color="white" textAlign={'center'}>Max 90 day vELO Rating</Th>
              <Th color="white">ZP profile</Th>
              <Th color="white">Group</Th>
            </Tr>
          </Thead>
          <Tbody>
            {signups.map((signup) => (
              <Tr key={signup.id}>
                <Td>{signup.displayName}</Td>
                <Td>{signup.phenotypeValue ?? 'N/A'}</Td>
                <Td textAlign={'center'}>{Math.round(signup.currentRating || 0)}</Td>
                <Td textAlign={'center'}>{Math.round(signup.max30Rating || 0)}</Td>
                <Td textAlign={'center'}>{Math.round(signup.max90Rating || 0)}</Td>
                <Td textAlign="center"><Link  color={'orange'} href = {`https://zwiftpower.com/profile.php?z=${signup.zwiftID}`} target='_Blank' isExternal>ZwiftPower<ExternalLinkIcon mx='2px' /></Link></Td>
                <Td>{signup.group !== undefined ? signup.group : 'N/A'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default KMS;
