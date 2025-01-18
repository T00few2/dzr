// app/api/updatesignups/route.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { Signup } from '@/app/types/Signup'; // Importing Signup interface
import * as admin from 'firebase-admin';
import { WriteBatch } from 'firebase-admin/firestore';

/**
 * Type guard to check if a signup has a valid currentRating.
 * @param signup - The Signup object to check.
 * @returns True if currentRating is a valid number, false otherwise.
 */
function hasValidCurrentRating(signup: Signup): signup is Signup & { currentRating: number } {
  return typeof signup.currentRating === 'number' && !isNaN(signup.currentRating);
}

function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  // Decode the Base64 username:password
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Validate against environment variables
  return (
    username === process.env.API_USERNAME &&
    password === process.env.API_PASSWORD
  );
}

export async function GET(request: Request) {
  // Authenticate request
  if (!isAuthenticated(request)) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const responseDetails: { step: string; info: string }[] = []; // Array to store detailed information

  try {
    // 1) Fetch all signups using Admin SDK
    const querySnapshot = await adminDb.collection('raceSignups').get();
    const signups: Signup[] = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Signup[];

    // 2) For each signup, fetch updated race data and update Firestore
    for (const signup of signups) {
      if (!signup.zwiftID) {
        responseDetails.push({
          step: 'Validate Signup',
          info: `Signup ID=${signup.id} has no ZwiftID. Skipping...`,
        });
        continue;
      }

      const riderData: RaceData | null = await fetchZPdata(signup.zwiftID as string);

      if (!riderData) {
        responseDetails.push({
          step: 'Fetch Race Data',
          info: `Failed to fetch race data for ZwiftID=${signup.zwiftID}. Skipping...`,
        });
        continue;
      }

      const newCurrentRating = riderData.race.current.rating;
      const newMax30Rating = riderData.race.max30.rating;
      const newMax90Rating = riderData.race.max90.rating;
      const phenotypeValue = riderData.phenotype.value;
      const updatedAt = new Date().toISOString();

      try {
        // Attempt Firestore update
        await adminDb.collection('raceSignups').doc(signup.id).set(
          {
            currentRating: newCurrentRating,
            max30Rating: newMax30Rating,
            max90Rating: newMax90Rating,
            phenotypeValue: phenotypeValue,
            updatedAt: updatedAt,
          },
          { merge: true } // Ensures document is updated without overwriting existing fields
        );

        responseDetails.push({
          step: 'Update Signup',
          info: `Successfully updated Signup ID=${signup.id}.`,
        });

      } catch (updateErr) {
        if (updateErr instanceof Error) {
          responseDetails.push({
            step: 'Update Signup',
            info: `Error updating Signup ID=${signup.id}: ${updateErr.message}`,
          });
        } else {
          responseDetails.push({
            step: 'Update Signup',
            info: `Unknown error updating Signup ID=${signup.id}`,
          });
        }
      }
    }

    // 3) Group signups based on updated race data
    await groupSignups(signups, responseDetails);

    // 4) Return a JSON response with detailed logs
    return Response.json(
      {
        success: true,
        message: 'All signups updated with latest race data and regrouped successfully.',
        details: responseDetails,
      },
      {
        headers: { 'Cache-Control': 'no-store' }, // Disable caching for debugging
      }
    );
  } catch (err) {
    // Ensure `err` is narrowed before accessing its properties
    if (err instanceof Error) {
      responseDetails.push({
        step: 'Error Handling',
        info: `Error encountered: ${err.message}`,
      });
    } else {
      responseDetails.push({
        step: 'Error Handling',
        info: 'Unknown error encountered.',
      });
    }

    return Response.json(
      {
        success: false,
        message: 'Server error while updating and regrouping signups.',
        details: responseDetails,
      },
      { status: 500 }
    );
  }
}

/**
 * Groups the signups into 5 groups based on currentRating and updates Firestore.
 * @param signups Array of Signup objects.
 * @param responseDetails Array to log detailed information.
 */
async function groupSignups(signups: Signup[], responseDetails: { step: string; info: string }[]) {
  try {
    // 1. Filter out signups without a valid currentRating using the type guard
    const validSignups = signups.filter(hasValidCurrentRating);

    if (validSignups.length === 0) {
      responseDetails.push({
        step: 'Grouping',
        info: 'No valid signups available for grouping.',
      });
      return;
    }

    // 2. Sort signups by currentRating in descending order
    const sortedSignups = validSignups.sort(
      (a, b) => b.currentRating - a.currentRating
    );

    // 3. Determine group size
    const total = sortedSignups.length;
    const GROUP_COUNT = 5;
    const groupSize = Math.max(1, Math.floor(total / GROUP_COUNT));

    // 4. Assign group to each signup
    const groupedSignups: { signup: Signup; group: string }[] = sortedSignups.map(
      (signup, index) => {
        let groupNumber = Math.floor(index / groupSize) + 1;
        groupNumber = Math.min(groupNumber, GROUP_COUNT); // Ensure groupNumber does not exceed GROUP_COUNT
        return {
          signup,
          group: `group${groupNumber}`,
        };
      }
    );

    // 5. Use batch writes for efficient Firestore updates
    const batch: WriteBatch = adminDb.batch();

    groupedSignups.forEach(({ signup, group }) => {
      const docRef = adminDb.collection('raceSignups').doc(signup.id);
      batch.set(docRef, { group: group }, { merge: true });
    });

    // 6. Commit the batch
    await batch.commit();

    responseDetails.push({
      step: 'Grouping',
      info: `Successfully grouped ${groupedSignups.length} signups into ${GROUP_COUNT} groups using batch write.`,
    });

  } catch (groupErr) {
    if (groupErr instanceof Error) {
      responseDetails.push({
        step: 'Grouping Error',
        info: `Error during grouping: ${groupErr.message}`,
      });
    } else {
      responseDetails.push({
        step: 'Grouping Error',
        info: 'Unknown error during grouping.',
      });
    }
  }

  // Optionally, log the grouping details
  if (responseDetails.length > 0) {
    console.log('Grouping Details:', responseDetails);
  }
}
