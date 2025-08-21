import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

function stripTeamTag(name: string): string {
	return name.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
}

export async function GET(req: Request) {
	try {
		const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
		const discordId = (token as any)?.discordId as string | undefined;
		if (!discordId) {
			return NextResponse.json({ displayName: null }, { status: 200 });
		}

		// 1) Resolve ZwiftID from discord_users
		const discordUsersSnap = await adminDb
			.collection('discord_users')
			.where('discordID', '==', discordId)
			.limit(1)
			.get();

		if (discordUsersSnap.empty) {
			return NextResponse.json({ displayName: null }, { status: 200 });
		}

		const zwiftID = discordUsersSnap.docs[0].get('zwiftID');
		if (!zwiftID) {
			return NextResponse.json({ displayName: null }, { status: 200 });
		}

		// 2) Get latest club_stats document (ordered by timestamp desc)
		const latestStatsSnap = await adminDb
			.collection('club_stats')
			.orderBy('timestamp', 'desc')
			.limit(1)
			.get();

		if (latestStatsSnap.empty) {
			return NextResponse.json({ displayName: null }, { status: 200 });
		}

		const statsDoc = latestStatsSnap.docs[0];
		const riders: any[] = statsDoc.get('data')?.riders || [];
		const riderIdNum = typeof zwiftID === 'string' ? parseInt(zwiftID, 10) : Number(zwiftID);
		const rider = riders.find((r) => Number(r?.riderId) === riderIdNum);

		if (!rider || !rider.name) {
			return NextResponse.json({ displayName: null }, { status: 200 });
		}

		const displayName = stripTeamTag(String(rider.name));
		return NextResponse.json({ displayName }, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || 'Lookup failed' }, { status: 500 });
	}
}
