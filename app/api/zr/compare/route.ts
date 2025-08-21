export const dynamic = 'force-dynamic';
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

// Helper to convert YYMMDD → YYYY-MM-DD
function formatDate(input: string): string {
  if (!/^\d{6}$/.test(input)) throw new Error(`Invalid date format: ${input}`);
  const year = `20${input.slice(0, 2)}`;
  const month = input.slice(2, 4);
  const day = input.slice(4, 6);
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const todayRaw = searchParams.get('today');
    const yesterdayRaw = searchParams.get('yesterday');

    if (!todayRaw || !yesterdayRaw) {
      return NextResponse.json(
        { error: 'Missing required parameters: today and yesterday (YYMMDD)' },
        { status: 400 }
      );
    }

    const todayId = formatDate(todayRaw);
    const yesterdayId = formatDate(yesterdayRaw);

    const todayDoc = await db.collection('club_stats').doc(todayId).get();
    const yesterdayDoc = await db.collection('club_stats').doc(yesterdayId).get();

    if (!todayDoc.exists || !yesterdayDoc.exists) {
      return NextResponse.json(
        { error: 'One or both documents not found in Firestore' },
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

    const timeStamp = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', // CET/CEST depending on date
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());

    return NextResponse.json(
      {
        message: 'Comparison complete.',
        timeStamp: timeStamp,
        upgradedZPCategory,
        upgradedZwiftRacingCategory,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('Comparison error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
