'use server';

/**
 * @fileOverview Server Actions for user profile management.
 * These actions bridge the Next.js frontend with the NestJS UserService.
 */

import type { UserProfile } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { UserService } from '@/nestjs/user/user.service';
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the UserService instance
const getUserService = async (): Promise<UserService> => {
  const container = await AppContainer.getInstance();
  return container.get(UserService);
};

// --- User Profile Actions ---

export async function loadUserProfileAction(userId: string): Promise<{ success: boolean; profile?: UserProfile | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load user profile: ${userId}`, undefined, 'UserActions');
    const userService = await getUserService();
    const profile = await userService.loadUserProfile(userId);
    logMessage('debug', `[Action] User profile ${profile ? 'found' : 'not found'} for ID: ${userId}`, undefined, 'UserActions');
    return { success: true, profile };
  } catch (error) {
    logError(error, { message: `[Action] Error loading user profile ${userId}` }, 'UserActions');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load user profile.' };
  }
}

export async function createUserProfileAction(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to create user profile for ID: ${profileData.id}`, undefined, 'UserActions', { email: profileData.email });
    const userService = await getUserService();
    const newProfile = await userService.createUserProfile(profileData);
    logMessage('info', `[Action] User profile created successfully for ID: ${profileData.id}`, undefined, 'UserActions');
    return { success: true, profile: newProfile };
  } catch (error) {
    logError(error, { message: `[Action] Error creating user profile ${profileData.id}`, email: profileData.email }, 'UserActions');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create user profile.' };
  }
}

export async function updateUserProfileAction(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'role'>>): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to update user profile: ${userId}`, undefined, 'UserActions', { updates });
    const userService = await getUserService();
    await userService.updateUserProfile(userId, updates);
    logMessage('info', `[Action] User profile updated successfully: ${userId}`, undefined, 'UserActions');
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error updating user profile ${userId}`, updates }, 'UserActions');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update user profile.' };
  }
}
