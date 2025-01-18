// app/api/updatesignups/route.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { Signup } from '@/app/types/Signup'; // Importing Signup interface
import * as admin from 'firebase-admin';

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
          { merge: true } // Ensures document is created if it doesn't exist
        );

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
