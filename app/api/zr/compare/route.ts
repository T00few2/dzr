import { NextRequest, NextResponse } from 'next/server';
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

const db = admin.firestore();

// Category strength rankings for ZP
const zpCategoryRank = {
  'D': 1,
  'C': 2,
  'B': 3,
  'A': 4,
  'A+': 5,
};

function isZpCategory(cat: any): cat is keyof typeof zpCategoryRank {
  return typeof cat === 'string' && cat in zpCategoryRank;
}

export async function GET(request: NextRequest) {
  const today = new Date();
  const todayId = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayId = yesterday.toISOString().split('T')[0];

  try {
    const todayDoc = await db.collection('club_stats').doc(todayId).get();
    const yesterdayDoc = await db.collection('club_stats').doc(yesterdayId).get();

    if (!todayDoc.exists || !yesterdayDoc.exists) {
      return NextResponse.json(
        { message: 'One or both documents not found. Not enough data for comparison.' },
        { status: 404 }
      );
    }

    const todayRiders = todayDoc.data()?.data?.riders ?? [];
    const yesterdayRiders = yesterdayDoc.data()?.data?.riders ?? [];

    const todayMap = Object.fromEntries(todayRiders.map((r: any) => [r.riderId, r]));
    const yesterdayMap = Object.fromEntries(yesterdayRiders.map((r: any) => [r.riderId, r]));

    const upgradedZPCategory: { riderId: number; name: string; from: string; to: string }[] = [];
    const upgradedZwiftRacingCategory: {
      riderId: number;
      name: string;
      from: { category: string; number: number };
      to: { category: string; number: number };
    }[] = [];

    
    

    for (const riderIdStr of Object.keys(todayMap)) {
      const riderId = Number(riderIdStr);
      const today = todayMap[riderId];
      const yesterday = yesterdayMap[riderId];

      if (!today || !yesterday) continue;

      const name = today.name ?? 'Unknown';

      // ZP category upgrade
      const todayCat = today.zpCategory;
      const yesterdayCat = yesterday.zpCategory;
      

      if (
        isZpCategory(todayCat) &&
        isZpCategory(yesterdayCat) &&
        todayCat !== yesterdayCat &&
        zpCategoryRank[todayCat] > zpCategoryRank[yesterdayCat]
      ) {
        upgradedZPCategory.push({ riderId, name, from: yesterdayCat, to: todayCat });
      }

      // ZwiftRacing category number upgrade (lower number is better)
      const todayMixed = today?.race?.current?.mixed;
      const yesterdayMixed = yesterday?.race?.current?.mixed;

      if (
        todayMixed &&
        yesterdayMixed &&
        typeof todayMixed.number === 'number' &&
        typeof yesterdayMixed.number === 'number' &&
        todayMixed.number < yesterdayMixed.number
      ) {
        upgradedZwiftRacingCategory.push({
          riderId,
          name,
          from: yesterdayMixed,
          to: todayMixed,
        });
      }
    }
    

    return NextResponse.json({
      message: 'Comparison complete.',
      upgradedZPCategory,
      upgradedZwiftRacingCategory,
    });
  } catch (err: any) {
    console.error('Error during comparison:', err);
    return NextResponse.json(
      { error: 'Comparison failed', details: err.message },
      { status: 500 }
    );
  }
}
