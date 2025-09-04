export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

type RiderRow = {
  riderId: number;
  name: string;
  country?: string;
  zpCategory?: string;
  racingScore?: number | null;
  veloRating?: number | null;
  max30Rating?: number | null;
  max90Rating?: number | null;
  zpFTP?: number | null;
  phenotype?: string | null;
  weight?: number | null;
  w5?: number | null; w15?: number | null; w30?: number | null; w60?: number | null; w120?: number | null; w300?: number | null; w1200?: number | null;
  wkg5?: number | null; wkg15?: number | null; wkg30?: number | null; wkg60?: number | null; wkg120?: number | null; wkg300?: number | null; wkg1200?: number | null;
  cp?: number | null;
  compoundScore?: number | null;
};

const SIGNUPS_COLLECTION = 'kms_signups';

export async function GET(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    const discordId = (token as any)?.discordId as string | undefined;

    // Load latest club stats
    const snap = await adminDb
      .collection('club_stats')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return NextResponse.json({ items: [], total: 0, date: null, currentUserSignedUp: false });
    const doc = snap.docs[0];
    const docData = doc.data() as any;
    const riders: any[] = Array.isArray(docData?.data?.riders) ? docData.data.riders : [];

    // Load signups
    const signupsSnap = await adminDb.collection(SIGNUPS_COLLECTION).get();
    const signedZwiftIds = new Set<string>();
    const signedDiscordIds = new Set<string>();
    signupsSnap.forEach(d => {
      const data = d.data() as any;
      const zw = data?.zwiftID != null ? String(data.zwiftID) : '';
      const did = data?.discordId != null ? String(data.discordId) : d.id;
      if (zw) signedZwiftIds.add(zw);
      if (did) signedDiscordIds.add(did);
    });

    // Filter riders to only those that are signed up
    const items: RiderRow[] = riders
      .filter((r: any) => signedZwiftIds.has(String(r?.riderId)))
      .map((r: any) => ({
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

    const currentUserSignedUp = discordId ? signedDiscordIds.has(discordId) : false;
    return NextResponse.json({ items, total: items.length, date: doc.id, currentUserSignedUp });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load signups' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    const discordId = (token as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve ZwiftID from discord_users
    const discordSnap = await adminDb
      .collection('discord_users')
      .where('discordID', '==', discordId)
      .limit(1)
      .get();
    if (discordSnap.empty) return NextResponse.json({ error: 'No linked ZwiftID' }, { status: 400 });
    const zwiftID = String(discordSnap.docs[0].get('zwiftID') || '');
    if (!zwiftID) return NextResponse.json({ error: 'No linked ZwiftID' }, { status: 400 });

    // Upsert signup document with discordId as id
    await adminDb.collection(SIGNUPS_COLLECTION).doc(discordId).set({
      discordId,
      zwiftID,
      createdAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to sign up' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    const discordId = (token as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await adminDb.collection(SIGNUPS_COLLECTION).doc(discordId).delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to withdraw' }, { status: 500 });
  }
}


