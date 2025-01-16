// app/utils/updateGroupsInFirestore.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';

interface GroupedDataBySignupId {
  [signupId: string]: number; // Mapping from signup.id to group number
}

export async function updateGroupsInFirestore(groupedData: GroupedDataBySignupId): Promise<void> {
  try {
    const batch = adminDb.batch();

    for (const [signupId, groupNumber] of Object.entries(groupedData)) {
      const docRef = adminDb.collection('raceSignups').doc(signupId);
      const doc = await docRef.get();

      if (doc.exists) {
        batch.update(docRef, { group: groupNumber });
      } else {
        console.warn(`No document found for Signup ID=${signupId}. Skipping update.`);
        // Optionally, you can choose to create the document if it doesn't exist:
        // batch.set(docRef, { group: groupNumber }, { merge: true });
      }
    }

    await batch.commit();
    console.log('Batch update of groups in Firestore successful.');
  } catch (err) {
    console.error('Batch update of groups in Firestore failed:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }
}
