export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const q = (searchParams.get('search') || '').toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // Build set of zwiftIDs that are linked from discord_users
    const linkedSnap = await adminDb.collection('discord_users').get();
    const linkedZwiftIds = new Set<string>();
    linkedSnap.forEach((d) => {
      const z = (d.data() as any)?.zwiftID;
      if (z !== undefined && z !== null && String(z).trim() !== '') linkedZwiftIds.add(String(z));
    });

    const docId = date || (await getLatestId());
    if (!docId) return NextResponse.json({ total: 0, items: [] });

    const doc = await adminDb.collection('club_stats').doc(docId).get();
    if (!doc.exists) return NextResponse.json({ total: 0, items: [] });
    const riders: any[] = (doc.data() as any)?.data?.riders || [];

    const filteredBase = riders.filter((r) => linkedZwiftIds.has(String(r?.riderId)));
    const filtered = q
      ? filteredBase.filter((r) => (r?.name || '').toLowerCase().includes(q))
      : filteredBase;
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit).map((r) => ({
      riderId: r?.riderId ?? null,
      name: r?.name ?? null,
      country: r?.country ?? null,
      zpCategory: r?.zpCategory ?? null,
      racingScore: typeof r?.racingScore === 'number' ? r.racingScore : null,
      veloRating: typeof r?.race?.current?.rating === 'number' ? r.race.current.rating : null,
      max30Rating: typeof r?.race?.max30?.rating === 'number' ? r.race.max30.rating : null,
      max90Rating: typeof r?.race?.max90?.rating === 'number' ? r.race.max90.rating : null,
      phenotype: r?.phenotype?.value ?? null,
      weight: r?.weight ?? null,
    }));

    return NextResponse.json({ total, items, date: docId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load riders' }, { status: 500 });
  }
}

async function getLatestId(): Promise<string | null> {
  const snap = await adminDb
    .collection('club_stats')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}


