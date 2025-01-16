// app/utils/groupSignups.ts

import { Signup } from '@/app/types/Signup';
import { updateGroupsInFirestore } from '@/app/utils/updateGroupsInFirestore';

interface GroupedData {
  [groupName: string]: { zwift_id: number; ranking: number }[]; // e.g., { "group5": [{zwift_id:3511489, ranking:1309}, ...], "group6": [...] }
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
      // Add more mappings if there are more groups
    };

    // Create a mapping from 'signup.id' to group number
    const groupBySignupId: GroupedDataBySignupId = {};

    // Iterate through each group and assign group numbers
    for (const [groupName, riders] of Object.entries(groupedData)) {
      const groupNumber = groupNameToNumber[groupName];
      if (groupNumber === undefined) {
        console.warn(`No group number mapping found for groupName=${groupName}`);
        continue;
      }

      riders.forEach((rider) => {
        const signupDoc = signups.find(
          (s) => parseInt(s.zwiftID as string, 10) === rider.zwift_id
        );
        if (signupDoc) {
          groupBySignupId[signupDoc.id] = groupNumber;
        } else {
          console.warn(`No signup found for ZwiftID=${rider.zwift_id}`);
        }
      });
    }

    console.log('Grouped Data Mapped to Signup IDs:', JSON.stringify(groupBySignupId));

    // Update Firestore with group info using signup.id
    await updateGroupsInFirestore(groupBySignupId);

    console.log('Grouping of signups completed successfully.');
  } catch (err) {
    console.error('Failed to group signups:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }
}
