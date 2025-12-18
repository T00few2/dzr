import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as admin from 'firebase-admin';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
			clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
			privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
		}),
		databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
	});
}

export async function GET(req: Request) {
	try {
		const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
		if (!token || !(token as any).discordId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const discordId = (token as any).discordId as string;
		const email = ((token as any).email as string | undefined) || undefined;
		const authAdmin = admin.auth();
		const db = admin.firestore();

		let targetUid: string | null = null;

		// 1) Prefer existing account by verified email
		if (email) {
			try {
				const existingByEmail = await authAdmin.getUserByEmail(email);
				targetUid = existingByEmail.uid;
			} catch (err: any) {
				if (err?.code !== 'auth/user-not-found') {
					throw err;
				}
			}
		}

		// 2) Else check users collection for existing firebaseUid
		if (!targetUid) {
			const userDoc = await db.collection('users').doc(discordId).get();
			if (userDoc.exists) {
				const userData = userDoc.data() as any;
				if (userData?.firebaseUid) {
					targetUid = userData.firebaseUid;
				}
			}
		}

		// 3) Else create a new Firebase user with auto-generated UID
		if (!targetUid) {
			const created = await authAdmin.createUser(email ? { email } : {});
			targetUid = created.uid;
		}

		// Persist Discord linkage and profile in users collection
		try {
			const userRecord = await authAdmin.getUser(targetUid);
			const existingClaims = (userRecord.customClaims as Record<string, unknown>) || {};
			if (existingClaims.discordId !== discordId) {
				await authAdmin.setCustomUserClaims(targetUid, { ...existingClaims, discordId });
			}
			await db
				.collection('users')
				.doc(discordId)
				.set(
					{
						discordId,
						email: email ?? userRecord.email ?? null,
						firebaseUid: targetUid,
						updatedAt: admin.firestore.FieldValue.serverTimestamp(),
					},
					{ merge: true }
				);
		} catch (_) {
			// non-fatal
		}

		const customToken = await authAdmin.createCustomToken(targetUid, { discordId, email });
		return NextResponse.json({ customToken });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || 'Failed to create token' }, { status: 500 });
	}
}
