// app/api/updatesignups/route.ts


import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { Signup } from '@/app/types/Signup'; // Importing Signup interface
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export async function GET(request: Request) {
  const responseDetails: { step: string; info: string }[] = []; // Array to store detailed information

  responseDetails.push({
    step: 'Admin',
    info: `Admin length ${admin.apps.length}`,
  });

  try {
    await adminDb.collection('test').doc('testDoc').set({ test: 'value' });
    responseDetails.push({
      step: 'Create Test',
      info: `Firestore write test successful.`,
    });
    
  } catch (err) {
    responseDetails.push({
      step: 'Create Test',
      info: `Firestore write test failed: ${err}`,
    });
  }

  try {
    // 1) Fetch all signups using Admin SDK
    const querySnapshot = await adminDb.collection('raceSignups').get();
    const signups: Signup[] = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Signup[];

    responseDetails.push({
      step: 'Fetch Signups',
      info: `Fetched ${signups.length} signups.`,
    });

    

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
