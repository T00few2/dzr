import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

export async function GET(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    const discordId = (token as any)?.discordId as string | undefined;
    if (!discordId) {
      return NextResponse.json({ zwiftId: null }, { status: 200 });
    }

    const snap = await adminDb
      .collection('discord_users')
      .where('discordID', '==', discordId)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ zwiftId: null }, { status: 200 });
    }

    const zwiftId = snap.docs[0].get('zwiftID') ?? null;
    return NextResponse.json({ zwiftId: zwiftId ? String(zwiftId) : null }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 });
  }
}


