import { NextRequest, NextResponse } from 'next/server';
import { fetchClubdata, ClubData } from '@/app/utils/fetchZPdata';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (if not already initialized)
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

// Firestore database reference
const db = admin.firestore();

// Helper: Zwift Pacing Group ranking
const zpCategoryRank = {
  'D': 1,
  'C': 2,
  'B': 3,
  'A': 4,
  'A+': 5,
};

/**
 * GET /api/zr/[club]
 * Fetches the club data and stores it in Firestore under:
 * collection: "club_stats"
 * document: {YYYY-MM-DD}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { club: string } }
) {
  const { club } = params;

  if (!club) {
    return NextResponse.json({ error: 'Missing club ID' }, { status: 400 });
  }

  // Fetch club data
  const clubData: ClubData | null = await fetchClubdata(club);
  if (!clubData) {
    return NextResponse.json({ error: 'Unable to fetch club data' }, { status: 500 });
  }

  // Prepare Firestore document reference
  const dateId = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const docRef = db.collection('club_stats').doc(dateId);

  // Let the data expire in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Store the entire clubData directly under "club_stats/{YYYY-MM-DD}"
    await docRef.set({
      timestamp: new Date().toISOString(),
      clubId: club,
      data: clubData,
      expiresAt: expiresAt, 
    });

    console.log(`Data stored in Firestore: club_stats/${dateId}`);
  } catch (err) {
    console.error('Error saving data to Firestore:', err);
    return NextResponse.json({ error: 'Failed to save data', details: String(err) }, { status: 500 });
  }

  return NextResponse.json('Data saved', { status: 200 });
}
