// app/api/updateSignups/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';
import { fetchZPdata, RaceData } from '@/app/utils/fetchZPdata';
import { groupSignups } from '@/app/utils/groupSignups';
import { Signup } from '@/app/types/Signup'; // Importing Signup interface

export async function GET(request: NextRequest) {
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
      info: `Fetched ${signups.length} signups.`,
    });

    // 2) For each signup, fetch updated race data and update Firestore
    for (const signup of signups) {
      if (!signup.zwiftID) {
        responseDetails.push({
          step: 'Validate Signup',
          info: `Signup ID=${signup.id} has no ZwiftID. Skipping...`,
        });
        continue;
      }

      responseDetails.push({
        step: 'Fetch Race Data',
        info: `Fetching data for Signup ID=${signup.id} with ZwiftID=${signup.zwiftID}`,
      });

      const riderData: RaceData | null = await fetchZPdata(signup.zwiftID as string);

      if (!riderData) {
        responseDetails.push({
          step: 'Fetch Race Data',
          info: `Failed to fetch race data for ZwiftID=${signup.zwiftID}. Skipping update...`,
        });
        continue;
      }

      const newCurrentRating = riderData.race.current.rating;
      const phenotypeValue = riderData.phenotype.value;
      const updatedAt = new Date().toISOString();

      try {
        await adminDb.collection('raceSignups').doc(signup.id).update({
          currentRating: newCurrentRating,
          phenotypeValue: phenotypeValue,
          updatedAt: updatedAt,
        });

        responseDetails.push({
          step: 'Update Signup',
          info: `Updated Signup ID=${signup.id}: currentRating=${newCurrentRating}, phenotypeValue=${phenotypeValue}`,
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
    await groupSignups(signups);
    responseDetails.push({
      step: 'Group Signups',
      info: 'Signups grouped successfully based on updated race data.',
    });

    // 4) Return a JSON response with detailed logs
    return NextResponse.json({
      success: true,
      message: 'All signups updated with latest race data and regrouped successfully.',
      details: responseDetails,
    });
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

    return NextResponse.json(
      {
        success: false,
        message: 'Server error while updating and regrouping signups.',
        details: responseDetails,
      },
      { status: 500 }
    );
  }
}
