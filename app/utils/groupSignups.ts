// app/utils/groupSignups.ts

import { Signup } from '@/app/types/Signup';
import { updateGroupsInFirestore } from '@/app/utils/updateGroupsInFirestore';

interface GroupedData {
  [zwift_id: number]: number; // Mapping from zwift_id to group number
}

export async function groupSignups(signups: Signup[]): Promise<void> {
  // Build the payload for groupByVELO
  const ridersPayload = signups
    .filter((s) => s.zwiftID && s.currentRating !== undefined)
    .map((s) => ({
      zwift_id: parseInt(s.zwiftID as string, 10),
      ranking: s.currentRating as number,
    }));

  console.log('Riders Payload:', JSON.stringify(ridersPayload));

  try {
    // Call your groupByVELO endpoint (API Gateway)
    const response = await fetch('https://gijpv4f7xe.execute-api.eu-north-1.amazonaws.com/prod/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riders: ridersPayload }),
    });

    console.log('groupByVELO Response Status:', response.status);

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Error grouping signups: ${response.status} - ${responseText}`);
    }

    const groupedData: GroupedData = await response.json();

    console.log('Grouped Data Received:', JSON.stringify(groupedData));

    // Update Firestore with group info
    await updateGroupsInFirestore(groupedData);

    console.log('Grouping of signups completed successfully.');
  } catch (err) {
    console.error('Failed to group signups:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }
}
