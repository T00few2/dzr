// app/utils/updateGroupsInFirestore.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';

interface GroupedData {
  [zwift_id: number]: number; // Mapping from zwift_id to group number
}

export async function updateGroupsInFirestore(groupedData: GroupedData): Promise<void> {
  const batch = adminDb.batch();

  for (const [zwiftIdStr, groupNumber] of Object.entries(groupedData)) {
    const zwift_id = parseInt(zwiftIdStr, 10);
    if (isNaN(zwift_id)) {
      console.warn(`Invalid zwift_id: ${zwiftIdStr}. Skipping...`);
      continue;
    }

    // Query Firestore for documents with the given zwiftID
    const querySnapshot = await adminDb.collection('raceSignups').where('zwiftID', '==', zwift_id).get();

    if (querySnapshot.empty) {
      console.warn(`No signup found with zwiftID=${zwift_id}. Skipping...`);
      continue;
    }

    querySnapshot.forEach((doc) => {
      const docRef = adminDb.collection('raceSignups').doc(doc.id);
      batch.update(docRef, { group: groupNumber });
      console.log(`Assigned Signup ID=${doc.id} with zwiftID=${zwift_id} to group ${groupNumber}.`);
    });
  }

  try {
    await batch.commit();
    console.log('All groups have been updated successfully.');
  } catch (error) {
    console.error('Error committing batch update for groups:', error);
  }
}
