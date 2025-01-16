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

  try {
    // Call your groupByVELO endpoint (API Gateway)
    const response = await fetch('https://gijpv4f7xe.execute-api.eu-north-1.amazonaws.com/prod/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riders: ridersPayload }),
    });

    if (!response.ok) {
      throw new Error(`Error grouping signups: ${response.status}`);
    }

    const groupedData: GroupedData = await response.json();

    // Update Firestore with group info
    await updateGroupsInFirestore(groupedData);

    console.log('Grouping of signups completed successfully.');
  } catch (err) {
    console.error('Failed to group signups:', err);
  }
}
