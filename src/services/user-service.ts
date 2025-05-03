
'use server';

import type { UserProfile } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { UserService as NestUserService } from '@/nestjs/user/user.service';
import { logMessage, logError } from '@/services/logging-service';

const getUserService = async (): Promise<NestUserService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestUserService);
};

// --- Server Actions ---

/** Loads a user profile from Firestore. */
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    logMessage('debug', `Attempting to load user profile: ${userId}`);
    const service = await getUserService();
    const profile = await service.loadUserProfile(userId);
    logMessage('debug', `User profile ${profile ? 'found' : 'not found'} for ID: ${userId}`);
    return profile;
  } catch (error) {
    logError(error, { message: `Error loading user profile ${userId}` });
    return null;
  }
}

/** Creates a new user profile in Firestore. */
export async function createUserProfile(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  try {
    logMessage('info', `Attempting to create user profile for ID: ${profileData.id}`, { email: profileData.email });
    const service = await getUserService();
    const newProfile = await service.createUserProfile(profileData);
    logMessage('info', `User profile created successfully for ID: ${profileData.id}`);
    return newProfile;
  } catch (error) {
    logError(error, { message: `Error creating user profile ${profileData.id}`, email: profileData.email });
    throw new Error(`Failed to create user profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Updates specific fields of a user profile. */
export async function updateUserProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'role'>>): Promise<void> {
  try {
    logMessage('info', `Attempting to update user profile: ${userId}`, { updates });
    const service = await getUserService();
    await service.updateUserProfile(userId, updates);
    logMessage('info', `User profile updated successfully: ${userId}`);
  } catch (error) {
    logError(error, { message: `Error updating user profile ${userId}`, updates });
    throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}
