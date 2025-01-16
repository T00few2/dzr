// app/utils/groupSignups.ts

import { Signup } from '@/app/types/Signup';
import { updateGroupsInFirestore } from '@/app/utils/updateGroupsInFirestore';

interface GroupedData {
  [groupName: string]: number[]; // e.g., { "group5": [3511489, 12345], "group6": [15690, 67890] }
}

interface GroupedDataBySignupId {
  [signupId: string]: number; // Mapping from signup.id to group number
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

    // Define a mapping from group names to group numbers
    const groupNameToNumber: { [groupName: string]: number } = {
      'group1': 1,
      'group2': 2,
      'group3': 3,
      'group4': 4,
      'group5': 5,
      // Add more mappings as needed
    };

    // Create a mapping from 'signup.id' to group number
    const groupBySignupId: GroupedDataBySignupId = {};

    signups.forEach((signup) => {
      const zwiftId = parseInt(signup.zwiftID as string, 10);
      // Find which group the zwiftId belongs to
      const groupEntry = Object.entries(groupedData).find(([groupName, zwiftIds]) =>
        zwiftIds.includes(zwiftId)
      );

      if (groupEntry) {
        const [groupName, zwiftIds] = groupEntry;
        const groupNumber = groupNameToNumber[groupName];
        if (groupNumber !== undefined) {
          groupBySignupId[signup.id] = groupNumber;
        } else {
          console.warn(`No group number mapping found for groupName=${groupName}`);
        }
      } else {
        console.warn(`No group found for ZwiftID=${zwiftId}`);
      }
    });

    console.log('Grouped Data Mapped to Signup IDs:', JSON.stringify(groupBySignupId));

    // Update Firestore with group info using signup.id
    await updateGroupsInFirestore(groupBySignupId);

    console.log('Grouping of signups completed successfully.');
  } catch (err) {
    console.error('Failed to group signups:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }
}
