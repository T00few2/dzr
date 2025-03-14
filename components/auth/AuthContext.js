// components/auth/AuthContext.js

'use client';

import React, { createContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
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
     * Initializes Firebase Auth and sets up the auth state listener.
     */
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false); // Auth state has been determined
    });

    // Cleanup the listener on unmount
    return () => unsubscribe();
  }, []);

  /**
   * Logs in a user with email and password.
   * Sets the persistence to session before signing in.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   */
  const login = async (email, password) => {
    try {
      // Set persistence to session for the login operation
      await setPersistence(auth, browserLocalPersistence);
      console.log('Persistence set to browserLocalPersistence for login');

      // Perform the sign-in operation
      await signInWithEmailAndPassword(auth, email, password);
      console.log('User logged in:', email);
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  };

  /**
   * Signs up a new user with email, password, and display name.
   * Sets the persistence to session before signing up.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   * @param {string} displayName - User's display name.
   * @returns {object} - The newly created user object.
   */
  const signup = async (email, password, displayName) => {
    try {
      // Set persistence to session for the signup operation
      await setPersistence(auth, browserSessionPersistence);
      console.log('Persistence set to browserSessionPersistence for signup');

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user; // Get the user object

      // Update the user's profile with the display name
      await updateProfile(user, { displayName });

      console.log('User signed up:', email);
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
