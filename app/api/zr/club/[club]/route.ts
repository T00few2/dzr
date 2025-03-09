// app/api/zr/[club]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchClubdata, ClubData } from '@/app/utils/fetchZPdata';
import * as admin from 'firebase-admin';

// 1. Initialize your Firebase Admin app (only once!)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      // Make sure to replace escaped newlines in the private key
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}

// 2. Get reference to Firestore DB
const db = admin.firestore();

/**
 * Example: GET /api/zr/15690
 * Dynamically fetch rider data for the provided "id"
 * and immediately store it in Firestore.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { club: string } }
) {
  const { club } = params;

  if (!club) {
    return NextResponse.json(
      { error: 'Missing club ID' },
      { status: 400 }
    );
  }

  // Fetch the rider/club data
  const clubData: ClubData | null = await fetchClubdata(club);

  if (!clubData) {
    return NextResponse.json(
      { error: 'Unable to fetch club data' },
      { status: 500 }
    );
  }

  // 3. Write to Firestore
  try {
    // E.g. store in a "weeklyZrData" collection, new doc each time
    await db.collection('ZRClubData').add({
      clubId: club,
      data: clubData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error writing to Firestore:', err);
    return NextResponse.json(
      { error: 'Failed to save to Firestore', details: String(err) },
      { status: 500 }
    );
  }

  // 4. Return the data as JSON as usual
  return NextResponse.json(clubData, { status: 200 });
}
