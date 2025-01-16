// components/auth/AuthContext.js

'use client';

import React, { createContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/app/utils/firebaseConfig'; // Adjust the path if needed

export const AuthContext = createContext();

/**
 * AuthProvider Component
 * Provides authentication context to its children.
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // Manage loading state

  useEffect(() => {
    /**
     * Initializes Firebase Auth persistence and sets up the auth state listener.
     */
    const initializeAuth = async () => {
      try {
        // Set persistence to session so the user stays logged in until the browser is closed
        await setPersistence(auth, browserSessionPersistence);

        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
          setLoading(false); // Auth state has been determined
        });

        // Cleanup the listener on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting persistence or initializing auth:', error);
        setLoading(false); // Even on error, stop the loading state
      }
    };

    initializeAuth();
  }, []);

  /**
   * Logs in a user with email and password.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   */
  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  };

  /**
   * Signs up a new user with email, password, and display name.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   * @param {string} displayName - User's display name.
   * @returns {object} - The newly created user object.
   */
  const signup = async (email, password, displayName) => {
    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user; // Get the user object

      // Update the user's profile with the display name
      await updateProfile(user, { displayName });

      return user; // Return user object after successful signup
    } catch (error) {
      console.error('Signup failed:', error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, signup, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
