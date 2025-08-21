// components/auth/AuthContext.js

'use client';

import React, { createContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import { auth } from '@/app/utils/firebaseConfig';
import { useSession } from 'next-auth/react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Bridge NextAuth session -> Firebase custom token sign-in
  useEffect(() => {
    async function bridgeSessionToFirebase() {
      try {
        if (auth.currentUser) return;
        if (session?.user) {
          const resp = await fetch('/api/auth/firebase-token');
          if (!resp.ok) return;
          const { customToken } = await resp.json();
          if (customToken) {
            await signInWithCustomToken(auth, customToken);
          }
        }
      } catch (_) {}
    }
    bridgeSessionToFirebase();
  }, [session]);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
