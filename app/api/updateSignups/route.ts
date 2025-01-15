// app/api/updateSignups/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { groupSignups } from '@/app/utils/groupSignups';
import { Signup } from '@/app/types/Signup'; // Importing Signup interface

export async function GET(request: NextRequest) {
  try {
    // 1) Fetch all signups using Admin SDK
    const querySnapshot = await adminDb.collection('raceSignups').get();
    const signups: Signup[] = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Signup[];

    console.log(`Fetched ${signups.length} signups.`);

    // 2) For each signup, fetch updated race data and update Firestore
    for (const signup of signups) {
      if (!signup.zwiftID) {
        console.warn(`Signup ID=${signup.id} has no ZwiftID. Skipping...`);
        continue;
      }

      console.log(`Updating Signup ID=${signup.id} with ZwiftID=${signup.zwiftID}`);

      const riderData: RaceData | null = await fetchZPdata(signup.zwiftID as string);

      if (!riderData) {
        console.warn(`Failed to fetch race data for ZwiftID=${signup.zwiftID}. Skipping update...`);
        continue;
      }

      console.log(`Received race data for ZwiftID=${signup.zwiftID}:`, riderData);

      const newCurrentRating = riderData.race.current.rating;
      const phenotypeValue = riderData.phenotype.value;
      const updatedAt = new Date().toISOString();

      // Update the doc in Firestore using Admin SDK
      try {
        await adminDb.collection('raceSignups').doc(signup.id).update({
          currentRating: newCurrentRating,
          phenotypeValue: phenotypeValue,
          updatedAt: updatedAt,
        });

        console.log(`Updated Signup ID=${signup.id}: currentRating=${newCurrentRating}, phenotypeValue=${phenotypeValue}`);
      } catch (updateErr) {
        console.error(`Error updating Signup ID=${signup.id}:`, updateErr);
      }
    }

    // 3) Group signups based on updated race data
    await groupSignups(signups);

    // 4) Return a JSON response using NextResponse
    return NextResponse.json({
      success: true,
      message: 'All signups updated with latest race data and regrouped successfully.',
    });
  } catch (err) {
    console.error('Error updating and regrouping:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
