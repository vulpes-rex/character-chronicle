
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/lib/types';

/**
 * Loads a user profile from Firestore.
 * @param userId - The Firebase Auth UID of the user.
 * @returns The user profile data, or null if not found.
 */
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const userDocRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserProfile;
    } else {
      console.log(`No profile found for user ID: ${userId}`);
      return null;
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    throw new Error('Failed to load user profile.');
  }
}

/**
 * Creates a new user profile in Firestore or updates if exists (use cautiously for creation).
 * Typically called once upon user signup or first login if profile doesn't exist.
 * @param profileData - The user profile data to save.
 * @returns The created/updated user profile data.
 */
export async function createUserProfile(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', profileData.id);
  const dataToSave = {
    ...profileData,
    // Ensure role is explicitly set, default to 'player' if somehow missing
    role: profileData.role || 'player',
    createdAt: serverTimestamp(), // Set on creation
    updatedAt: serverTimestamp(),
  };
  try {
    // Using setDoc with merge: false to ensure it creates or overwrites completely
    // Consider using setDoc with merge: true or updateDoc for updates later
    await setDoc(userDocRef, dataToSave, { merge: false });
    console.log('User profile created/set for ID:', profileData.id);
    // We don't get the timestamps back immediately, so return what we sent + ID
    return { ...profileData, role: dataToSave.role, createdAt: new Date(), updatedAt: new Date() }; // Approximate timestamps
  } catch (error) {
    console.error('Error creating/setting user profile:', error);
    throw new Error('Failed to create user profile.');
  }
}

/**
 * Updates specific fields of a user profile.
 * @param userId - The Firebase Auth UID of the user.
 * @param updates - An object containing the fields to update.
 */
export async function updateUserProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'role'>>): Promise<void> {
  const userDocRef = doc(db, 'users', userId);
  const dataToUpdate: Record<string, any> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(userDocRef, dataToUpdate);
    console.log('User profile updated for ID:', userId);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error('Failed to update user profile.');
  }
}
