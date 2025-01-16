// app/utils/updateGroupsInFirestore.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';

interface GroupedData {
  [zwift_id: number]: number;
}

export async function updateGroupsInFirestore(groupedData: GroupedData): Promise<void> {
  try {
    const batch = adminDb.batch();

    Object.entries(groupedData).forEach(([zwift_id, group_number]) => {
      const docRef = adminDb.collection('raceSignups').doc(zwift_id.toString());
      batch.update(docRef, { group: group_number });
    });

    await batch.commit();
    console.log('Batch update of groups in Firestore successful.');
  } catch (err) {
    console.error('Batch update of groups in Firestore failed:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }
}
