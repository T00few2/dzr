// app/api/zr/[club]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// 1. Initialize your Firebase Admin app (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}
const db = admin.firestore();

export async function GET(
  request: NextRequest,
  { params }: { params: { club: string } }
) {
  const { club } = params;

  // NOTE: Skip the real fetch, returning some dummy data for testing
  const clubData = {
    clubId: club,
    name: 'My Fake Club',
    riders: [
      {
        riderId: 123,
        name: 'Test Rider 1',
        power: { w5: 500, w60: 400 },
      },
      {
        riderId: 456,
        name: 'Test Rider 2',
        power: { w5: 600, w60: 450 },
      },
    ],
  };

  // 2. Write the test data to Firestore
  try {
    await db.collection('weeklyZrData').add({
      clubId: club,
      data: clubData,
      timestamp: new Date().toISOString(),
    });
    console.log('Wrote test data to Firestore successfully!');
  } catch (err) {
    console.error('Error writing test data:', err);
    return NextResponse.json(
      { error: 'Failed to save test data to Firestore', details: String(err) },
      { status: 500 }
    );
  }

  // 3. Return the test data
  return NextResponse.json(clubData, { status: 200 });
}
