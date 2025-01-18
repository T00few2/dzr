// /app/api/firebase-test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/utils/firebaseAdminConfig';

// Import Firebase Admin SDK
import * as admin from 'firebase-admin';

// Define the structure of the response for successful user retrieval
interface UserResponse {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  disabled: boolean;
  metadata: admin.auth.UserMetadata;
  // Add other fields as necessary
}

// Define the structure of error responses
interface ErrorResponse {
  error: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // **Security Check:** Verify API Key
    const apiKey = request.headers.get('x-api-key');

    if (apiKey !== process.env.FIREBASE_TEST_API_KEY) {
      const unauthorized: ErrorResponse = { error: 'Unauthorized' };
      return NextResponse.json(unauthorized, { status: 401 });
    }

    // **Retrieve UID from Query Parameters**
    const uid = request.nextUrl.searchParams.get('uid');

    if (!uid) {
      const badRequest: ErrorResponse = { error: 'UID is required' };
      return NextResponse.json(badRequest, { status: 400 });
    }

    // **Fetch User Record from Firebase**
    const userRecord = await admin.auth().getUser(uid);

    // **Prepare Response Data**
    const userData: UserResponse = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName || '',
      photoURL: userRecord.photoURL || '',
      phoneNumber: userRecord.phoneNumber || '',
      disabled: userRecord.disabled,
      metadata: userRecord.metadata,
      // Include other fields as needed
    };

    return NextResponse.json({ user: userData }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user:', error);
    const serverError: ErrorResponse = {
      error: (error as Error).message || 'Internal Server Error',
    };
    return NextResponse.json(serverError, { status: 500 });
  }
}
