export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET() {
  try {
    // Previously restricted to linked ZwiftIDs; now include all riders

    const snap = await adminDb
      .collection('club_stats')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return NextResponse.json({ data: null }, { status: 200 });

    const doc = snap.docs[0];
    const raw = doc.data() as any;
    const riders = Array.isArray(raw?.data?.riders) ? raw.data.riders : [];

    // Trim rider fields for overview and normalize metrics
    const trimmed = riders
      .map((r: any) => ({
        riderId: r?.riderId ?? null,
        name: r?.name ?? null,
        country: r?.country ?? null,
        zpCategory: r?.zpCategory ?? null,
        racingScore: typeof r?.racingScore === 'number' ? r.racingScore : null,
        veloRating: typeof r?.rating === 'number' ? r.rating : null,
        phenotype: r?.phenotype?.value ?? null,
        weight: r?.weight ?? null,
      }));

    return NextResponse.json({
      id: doc.id,
      timestamp: raw?.timestamp ?? null,
      clubId: raw?.clubId ?? raw?.data?.clubId ?? null,
      riders: trimmed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load latest stats' }, { status: 500 });
  }
}


