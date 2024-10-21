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

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true); // Add loading state

    useEffect(() => {
        // Set persistence to local so the user stays logged in across sessions
        setPersistence(auth, browserSessionPersistence)
            .then(() => {
                // Listen for auth state changes
                return onAuthStateChanged(auth, (user) => {
                    setCurrentUser(user);
                    setLoading(false); // Set loading to false once we know the auth state
                });
            })
            .catch((error) => {
                console.error("Error setting persistence:", error);
                setLoading(false); // Ensure loading is false on error
            });
    }, []);

    const login = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Login failed:", error.message);
            throw error;
        }
    };

    const signup = async (email, password, displayName) => {
        try {
            // Create user with email and password
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user; // Get the user object
    
            // Use updateProfile function from Firebase
            await updateProfile(user, { displayName }); // Correctly update the profile
    
            return user; // Return user object after successful signup
        } catch (error) {
            console.error("Signup failed:", error.message);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, signup, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
