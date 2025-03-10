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
 * GET /api/zr/[club]
 * 1. Fetch the club's data (which may be large),
 * 2. Store it in Firestore under:
 *    clubs/{clubId}/dates/{dateId}/  ... splitted into chunk docs.
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

  // Prepare Firestore references.
  // We'll store under: clubs/{clubId}/dates/{YYYY-MM-DD}/
  const dateId = new Date().toISOString().split('T')[0];
  const dateDocRef = db
    .collection('clubs')
    .doc(club)              // use the club ID as doc name
    .collection('dates')
    .doc(dateId);

  try {
    // 3. Separate the riders array from the rest so the main doc is small.
    const { riders = [], ...rest } = clubData;

    // 4. Save top-level info in dateDocRef (excluding big riders array).
    //    e.g. store clubId, name, etc. plus a timestamp
    await dateDocRef.set({
      timestamp: new Date().toISOString(),
      clubInfo: rest  // everything except 'riders'
    });

    // 5. Chunk the riders array into multiple docs in a "files" subcollection.
    //    each doc must stay well below 1MB
    const chunkSize = 100;  // choose a size that keeps each doc under 1MB
    let fileIndex = 1;

    for (let i = 0; i < riders.length; i += chunkSize) {
      const slice = riders.slice(i, i + chunkSize);

      // subcollection reference
      const fileDocRef = dateDocRef
        .collection('files')
        .doc(`file${fileIndex}`);

      await fileDocRef.set({
        chunkIndex: fileIndex,
        riders: slice
      });

      fileIndex++;
    }

    console.log('Data successfully chunked and stored!');
  } catch (err) {
    console.error('Error writing chunked data to Firestore:', err);
    return NextResponse.json(
      { error: 'Failed to save chunked data', details: String(err) },
      { status: 500 }
    );
  }

  // 6. Return the fetched data as JSON to the client
  return NextResponse.json(clubData, { status: 200 });
}
