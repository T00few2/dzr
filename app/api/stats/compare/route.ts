export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('riderIds') || '';
    const rangeDays = Math.min(parseInt(searchParams.get('range') || '30', 10) || 30, 120);
    let riderIds = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (riderIds.length === 0) return NextResponse.json({ series: [] });

    // Restrict to riders that have linked zwiftIDs
    const linkedSnap = await adminDb.collection('discord_users').get();
    const linkedZwiftIds = new Set<string>();
    linkedSnap.forEach((d) => {
      const z = (d.data() as any)?.zwiftID;
      if (z !== undefined && z !== null && String(z).trim() !== '') linkedZwiftIds.add(String(z));
    });
    riderIds = riderIds.filter((id) => linkedZwiftIds.has(String(id)));
    if (riderIds.length === 0) return NextResponse.json({ series: {} });

    // Load last N documents ordered by timestamp desc
    const snap = await adminDb
      .collection('club_stats')
      .orderBy('timestamp', 'desc')
      .limit(rangeDays)
      .get();

    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
    const seriesMap: Record<string, { date: string; racingScore: number | null; veloRating: number | null }[]> = {};
    riderIds.forEach((id) => (seriesMap[id] = []));

    for (const doc of docs.reverse()) {
      const riders = Array.isArray(doc.data?.data?.riders) ? doc.data.data.riders : [];
      for (const rid of riderIds) {
        const r = riders.find((x: any) => String(x?.riderId) === String(rid));
        seriesMap[rid].push({
          date: doc.id,
          racingScore: typeof r?.racingScore === 'number' ? r.racingScore : null,
          veloRating: typeof r?.race?.current?.rating === 'number' ? r.race.current.rating : null,
        });
      }
    }

    return NextResponse.json({ series: seriesMap });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compare' }, { status: 500 });
  }
}


