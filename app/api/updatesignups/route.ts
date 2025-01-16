// app/api/updatesignups/route.ts

import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { groupSignups } from '@/app/utils/groupSignups';
import { Signup } from '@/app/types/Signup';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase initialized successfully.');
  } catch (initErr) {
    console.error('Failed to initialize Firebase:', initErr);
    // Optionally, handle initialization failure
  }
}

export async function GET(request: Request) {
  console.log('API /api/updatesignups invoked.');

  const responseDetails: { step: string; info: string }[] = [];

  responseDetails.push({
    step: 'Admin',
    info: `Admin length ${admin.apps.length}`,
  });

  try {
    // 1. Firestore Write Test
    try {
      await adminDb.collection('test').doc('testDoc').set({ test: 'value', timestamp: new Date().toISOString() });
      console.log('Firestore write test successful.');
      responseDetails.push({
        step: 'Create Test',
        info: `Firestore write test successful.`,
      });

      // Confirm write
      const testDoc = await adminDb.collection('test').doc('testDoc').get();
      if (testDoc.exists) {
        console.log('Fetched testDoc:', testDoc.data());
        responseDetails.push({
          step: 'Fetch Test',
          info: `Fetched testDoc: ${JSON.stringify(testDoc.data())}`,
        });
      } else {
        console.log('testDoc does not exist.');
        responseDetails.push({
          step: 'Fetch Test',
          info: `testDoc does not exist.`,
        });
      }
    } catch (err) {
      console.error('Firestore write test failed:', err);
      responseDetails.push({
        step: 'Create Test',
        info: `Firestore write test failed: ${err instanceof Error ? err.message : err}`,
      });
      throw err; // Re-throw to trigger outer catch
    }

    // 2. Fetch Signups
    let signups: Signup[] = [];
    try {
      const querySnapshot = await adminDb.collection('raceSignups').get();
      signups = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Signup[];

      console.log(`Fetched ${signups.length} signups.`);
      responseDetails.push({
        step: 'Fetch Signups',
        info: `Fetched ${signups.length} signups.`,
      });

      if (signups.length === 0) {
        console.log('No signups found. Exiting API.');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No signups to update.',
            details: responseDetails,
          }),
          {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          }
        );
      }
    } catch (err) {
      console.error('Error fetching signups:', err);
      responseDetails.push({
        step: 'Fetch Signups',
        info: `Error fetching signups: ${err instanceof Error ? err.message : err}`,
      });
      throw err;
    }

    // 3. Update Each Signup
    for (const signup of signups) {
      if (!signup.zwiftID) {
        console.log(`Signup ID=${signup.id} has no ZwiftID. Skipping...`);
        responseDetails.push({
          step: 'Validate Signup',
          info: `Signup ID=${signup.id} has no ZwiftID. Skipping...`,
        });
        continue;
      }

      console.log(`Fetching race data for Signup ID=${signup.id} with ZwiftID=${signup.zwiftID}`);
      responseDetails.push({
        step: 'Fetch Race Data',
        info: `Fetching data for Signup ID=${signup.id} with ZwiftID=${signup.zwiftID}`,
      });

      let riderData: RaceData | null = null;
      try {
        riderData = await fetchZPdata(signup.zwiftID as string);
        console.log(`Fetched race data for ZwiftID=${signup.zwiftID}:`, riderData);
        responseDetails.push({
          step: 'Fetch Race Data',
          info: `Fetched race data for ZwiftID=${signup.zwiftID}. ${JSON.stringify(riderData)}`,
        });
      } catch (fetchErr) {
        console.error(`Failed to fetch race data for ZwiftID=${signup.zwiftID}:`, fetchErr);
        responseDetails.push({
          step: 'Fetch Race Data',
          info: `Failed to fetch race data for ZwiftID=${signup.zwiftID}: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}`,
        });
        continue; // Skip update if fetch fails
      }

      if (!riderData) {
        console.log(`No race data found for ZwiftID=${signup.zwiftID}. Skipping update.`);
        responseDetails.push({
          step: 'Fetch Race Data',
          info: `No race data found for ZwiftID=${signup.zwiftID}. Skipping update...`,
        });
        continue;
      }

      const newCurrentRating = riderData.race.current.rating;
      const phenotypeValue = riderData.phenotype.value;
      const updatedAt = new Date().toISOString();

      try {
        await adminDb.collection('raceSignups').doc(signup.id).set(
          {
            currentRating: newCurrentRating,
            phenotypeValue: phenotypeValue,
            updatedAt: updatedAt,
          },
          { merge: true }
        );

        // Read back the document to confirm
        const updatedDoc = await adminDb.collection('raceSignups').doc(signup.id).get();
        if (updatedDoc.exists) {
          console.log(`Confirmed update for Signup ID=${signup.id}:`, updatedDoc.data());
          responseDetails.push({
            step: 'Update Signup',
            info: `Updated Signup ID=${signup.id}: currentRating=${newCurrentRating}, phenotypeValue=${phenotypeValue}, updatedAt=${updatedAt}`,
          });
        } else {
          console.log(`Failed to confirm update for Signup ID=${signup.id}. Document does not exist.`);
          responseDetails.push({
            step: 'Update Confirmation',
            info: `Failed to confirm update for Signup ID=${signup.id}. Document does not exist.`,
          });
        }
      } catch (updateErr) {
        console.error(`Error updating Signup ID=${signup.id}:`, updateErr);
        responseDetails.push({
          step: 'Update Signup',
          info: `Error updating Signup ID=${signup.id}: ${updateErr instanceof Error ? updateErr.message : updateErr}`,
        });
      }
    }

    // 4. Group signups based on updated race data
    try {
      await groupSignups(signups);
      console.log('Signups grouped successfully based on updated race data.');
      responseDetails.push({
        step: 'Group Signups',
        info: 'Signups grouped successfully based on updated race data.',
      });
    } catch (groupErr) {
      console.error('Error grouping signups:', groupErr);
      responseDetails.push({
        step: 'Group Signups',
        info: `Error grouping signups: ${groupErr instanceof Error ? groupErr.message : 'Unknown error'}`,
      });
      // Depending on your requirements, you might want to throw here to mark the entire API as failed
      // throw groupErr;
    }

    // 5. Return a JSON response with detailed logs
    return new Response(
      JSON.stringify({
        success: true,
        message: 'All signups updated with latest race data and regrouped successfully.',
        details: responseDetails,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in updatesignups API:', err);
    responseDetails.push({
      step: 'Error Handling',
      info: `Error encountered: ${errorMessage}`,
    });

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
