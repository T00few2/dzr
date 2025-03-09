// app/api/updatesignups/route.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchRiderdata, RiderData } from '@/app/utils/fetchZPdata';
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

/**
 * Interface representing the structure of grouped data returned by the groupByVELO API.
 */
interface GroupedData {
  riders: { zwift_id: number; ranking: number; group: number }[];
}

/**
 * Authenticates the incoming request using Basic Authentication.
 * @param request - The incoming HTTP request.
 * @returns True if authenticated, false otherwise.
 */
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

/**
 * Handles the GET request to update signups with latest race data and assign groups.
 * @param request - The incoming HTTP request.
 * @returns A JSON response indicating success or failure with detailed logs.
 */
export async function GET(request: Request) {
  // Authenticate request
  if (!isAuthenticated(request)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
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

    responseDetails.push({
      step: 'Fetch Signups',
      info: `Fetched ${signups.length} signups from Firestore.`,
    });

    // 2) Update each signup with the latest race data
    const updatedSignups: Signup[] = [];
    const raceDataBatch: WriteBatch = adminDb.batch();

    for (const signup of signups) {
      if (!signup.zwiftID) {
        responseDetails.push({
          step: 'Validate Signup',
          info: `Signup ID=${signup.id} has no ZwiftID. Skipping...`,
        });
        continue;
      }

      const riderData: RiderData | null = await fetchRiderdata(signup.zwiftID as string);

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

      // Prepare the update
      const docRef = adminDb.collection('raceSignups').doc(signup.id);
      raceDataBatch.set(docRef, {
        currentRating: newCurrentRating,
        max30Rating: newMax30Rating,
        max90Rating: newMax90Rating,
        phenotypeValue: phenotypeValue,
        updatedAt: updatedAt,
      }, { merge: true });

      updatedSignups.push({
        ...signup,
        currentRating: newCurrentRating,
        max30Rating: newMax30Rating,
        max90Rating: newMax90Rating,
        phenotypeValue: phenotypeValue,
        updatedAt: updatedAt,
      });

      responseDetails.push({
        step: 'Prepare Race Data Update',
        info: `Prepared update for Signup ID=${signup.id}.`,
      });
    }

    // Commit the batch update for race data
    await raceDataBatch.commit();
    responseDetails.push({
      step: 'Commit Race Data Updates',
      info: `Committed updates for ${updatedSignups.length} signups.`,
    });

    // 3) Assign groups based on updated currentRating via external API
    const ridersPayload = updatedSignups.map((s) => ({
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
        throw new Error(`Error grouping signups: ${response.status} ${response.statusText}`);
      }

      const groupedData: GroupedData = await response.json();

      responseDetails.push({
        step: 'Fetch Group Assignments',
        info: `Received group assignments for ${groupedData.riders.length} riders.`,
      });

      // 4) Update Firestore with group assignments using batch writes
      const groupBatch: WriteBatch = adminDb.batch();
      let updatedGroupCount = 0;

      groupedData.riders.forEach((rider) => {
        const signup = signups.find((s) => parseInt(s.zwiftID, 10) === rider.zwift_id);
        if (signup) {
          const docRef = adminDb.collection('raceSignups').doc(signup.id);
          groupBatch.set(docRef, { group: rider.group }, { merge: true });
          updatedGroupCount++;
        } else {
          responseDetails.push({
            step: 'Group Assignment',
            info: `No matching signup found for ZwiftID=${rider.zwift_id}.`,
          });
        }
      });

      await groupBatch.commit();
      responseDetails.push({
        step: 'Commit Group Assignments',
        info: `Committed group assignments for ${updatedGroupCount} signups.`,
      });

    } catch (groupErr) {
      if (groupErr instanceof Error) {
        responseDetails.push({
          step: 'Group Assign Error',
          info: `Error during grouping: ${groupErr.message}`,
        });
      } else {
        responseDetails.push({
          step: 'Group Assign Error',
          info: 'Unknown error during grouping.',
        });
      }
    }

    // 5) Return a JSON response with detailed logs
    return new Response(
      JSON.stringify({
        success: true,
        message: 'All signups updated with latest race data and regrouped successfully.',
        details: responseDetails,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );

  } catch (err) {
    // Handle unexpected errors
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

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Server error while updating and regrouping signups.',
        details: responseDetails,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Assigns groups to signups based on their currentRating via external API.
 * @param signups - Array of Signup objects with updated ratings.
 * @param responseDetails - Array to log detailed information.
 */
async function groupSignups(signups: Signup[], responseDetails: { step: string; info: string }[]) {
  // This function is now integrated within the GET handler for clarity and better flow.
  // If you prefer to keep it separate, you can move the group assignment logic here.
  // For this implementation, the group assignment is handled directly in the GET function.
}
