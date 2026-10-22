import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

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

function firestore() {
  return getFirestore();
}
firestore.FieldValue = FieldValue;
firestore.Timestamp = Timestamp;

const admin = {
  get apps() {
    return getApps();
  },
  initializeApp,
  credential: { cert },
  firestore,
  auth: getAuth,
  storage: getStorage,
};

if (!admin.apps.length) {
  const serviceAccount = certFromEnv();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'dzr-member-site-media',
  });
}

const adminDb = admin.firestore();

export { adminDb, admin };
