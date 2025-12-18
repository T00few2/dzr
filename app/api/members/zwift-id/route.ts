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

    const doc = await adminDb.collection('users').doc(discordId).get();

    if (!doc.exists) {
      return NextResponse.json({ zwiftId: null }, { status: 200 });
    }

    const zwiftId = doc.get('zwiftId') ?? null;
    return NextResponse.json({ zwiftId: zwiftId ? String(zwiftId) : null }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 });
  }
}


