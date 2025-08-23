export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

    const doc = await adminDb.collection('club_stats').doc(date).get();
    if (!doc.exists) return NextResponse.json({ data: null }, { status: 200 });

    const raw = doc.data() as any;
    const riders = Array.isArray(raw?.data?.riders) ? raw.data.riders : [];
    return NextResponse.json({ id: doc.id, timestamp: raw?.timestamp ?? null, riders });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load stats' }, { status: 500 });
  }
}


