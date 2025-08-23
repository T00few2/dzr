export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET() {
  try {
    // Build set of zwiftIDs that are linked from discord_users
    const linkedSnap = await adminDb.collection('discord_users').get();
    const linkedZwiftIds = new Set<string>();
    linkedSnap.forEach((d) => {
      const z = (d.data() as any)?.zwiftID;
      if (z !== undefined && z !== null && String(z).trim() !== '') linkedZwiftIds.add(String(z));
    });

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
      .filter((r: any) => linkedZwiftIds.has(String(r?.riderId)))
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


