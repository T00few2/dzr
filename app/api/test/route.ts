import { adminDb } from '@/app/utils/firebaseAdminConfig';

import * as admin from 'firebase-admin';



export async function GET(request: Request) {
  const responseDetails: { step: string; info: string }[] = []; // Array to store detailed information

  responseDetails.push({
    step: 'Admin',
    info: `Admin length ${admin.apps.length}`,
  });

  try {
    await adminDb.collection('test').doc('testDoc').set({ test: 'value' });
    responseDetails.push({
      step: 'Create Test',
      info: `Firestore write test successful.`,
    });
    
  } catch (err) {
    responseDetails.push({
      step: 'Create Test',
      info: `Firestore write test failed: ${err}`,
    });
  }
}