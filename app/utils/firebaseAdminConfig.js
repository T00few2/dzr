import * as admin from 'firebase-admin';

function certFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[firebase-admin] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY. Do not put the private key in NEXT_PUBLIC_*.'
    );
  }
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
