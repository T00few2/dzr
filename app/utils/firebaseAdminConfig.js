import * as admin from 'firebase-admin';

function certFromEnv() {
  const usingLegacyPublic =
    !process.env.FIREBASE_PRIVATE_KEY && Boolean(process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY);
  if (usingLegacyPublic) {
    console.warn(
      '[firebase-admin] FIREBASE_PRIVATE_KEY is missing; falling back to NEXT_PUBLIC_FIREBASE_PRIVATE_KEY. Copy the key to the server-only env name and rotate it.'
    );
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  return { projectId, clientEmail, privateKey };
}

if (!admin.apps.length) {
  const cert = certFromEnv();
  admin.initializeApp({
    credential: admin.credential.cert(cert),
    databaseURL: `https://${cert.projectId}.firebaseio.com`,
  });
}

const adminDb = admin.firestore();

export { adminDb, admin };
