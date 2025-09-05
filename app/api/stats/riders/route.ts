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

    // Previously restricted to linked ZwiftIDs; now include all riders

    const docId = date || (await getLatestId());
    if (!docId) return NextResponse.json({ total: 0, items: [] });

    const doc = await adminDb.collection('club_stats').doc(docId).get();
    if (!doc.exists) return NextResponse.json({ total: 0, items: [] });
    const riders: any[] = (doc.data() as any)?.data?.riders || [];

    const filteredBase = riders;
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
      zpFTP: typeof r?.zpFTP === 'number' ? r.zpFTP : null,
      phenotype: r?.phenotype?.value ?? null,
      weight: r?.weight ?? null,
      // Power absolute (watts)
      w5: typeof r?.power?.w5 === 'number' ? r.power.w5 : null,
      w15: typeof r?.power?.w15 === 'number' ? r.power.w15 : null,
      w30: typeof r?.power?.w30 === 'number' ? r.power.w30 : null,
      w60: typeof r?.power?.w60 === 'number' ? r.power.w60 : null,
      w120: typeof r?.power?.w120 === 'number' ? r.power.w120 : null,
      w300: typeof r?.power?.w300 === 'number' ? r.power.w300 : null,
      w1200: typeof r?.power?.w1200 === 'number' ? r.power.w1200 : null,
      // Power relative (w/kg)
      wkg5: typeof r?.power?.wkg5 === 'number' ? r.power.wkg5 : null,
      wkg15: typeof r?.power?.wkg15 === 'number' ? r.power.wkg15 : null,
      wkg30: typeof r?.power?.wkg30 === 'number' ? r.power.wkg30 : null,
      wkg60: typeof r?.power?.wkg60 === 'number' ? r.power.wkg60 : null,
      wkg120: typeof r?.power?.wkg120 === 'number' ? r.power.wkg120 : null,
      wkg300: typeof r?.power?.wkg300 === 'number' ? r.power.wkg300 : null,
      wkg1200: typeof r?.power?.wkg1200 === 'number' ? r.power.wkg1200 : null,
      // CP and compound score
      cp: typeof r?.power?.CP === 'number' ? r.power.CP : null,
      compoundScore: typeof r?.power?.compoundScore === 'number' ? r.power.compoundScore : null,
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


