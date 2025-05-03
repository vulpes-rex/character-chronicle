
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc, collection } from 'firebase/firestore';
import type { UserProfile } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.module'; // Updated path
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {

  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: LoggingService,
  ) {
    this.logger.setContext('UserService');
  }

  /** Loads a user profile from Firestore. */
  async loadUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) { this.logger.warn("loadUserProfile called with empty userId."); return null; }
    try {
        const profile = await this.userRepository.findById(userId);
        if (!profile) {
             this.logger.log(`No profile found for user ID: ${userId}`);
        }
        return profile;
    } catch (error) {
      this.logger.error(`Error loading user profile ${userId}`, error instanceof Error ? error.stack : undefined);
      throw new Error('Failed to load user profile.');
    }
  }

  /** Creates a new user profile in Firestore. */
  async createUserProfile(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    if (!profileData || !profileData.id) { this.logger.error("Missing required profile data or user ID."); throw new Error("Invalid user profile data for creation."); }

    const dataToSave: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        email: profileData.email,
        displayName: profileData.displayName,
        role: profileData.role || 'player', // Default role
    };

    try {
        // Use set with the user ID to ensure the document ID matches the Firebase Auth UID
        await this.userRepository.set(profileData.id, dataToSave as any); // Cast needed
        this.logger.log(`User profile created/set for ID: ${profileData.id}`);
        // Since set doesn't return the full object with server timestamps resolved immediately,
        // we return the input data with assumed current dates (or reload if exact dates are critical).
        return { ...profileData, role: dataToSave.role, createdAt: new Date(), updatedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error creating/setting user profile ${profileData.id}`, error instanceof Error ? error.stack : undefined, { email: profileData.email, role: profileData.role });
      throw new Error('Failed to create user profile.');
    }
  }

  /** Updates specific fields of a user profile. */
  async updateUserProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'role'>>): Promise<void> {
    if (!userId) { this.logger.error("Missing userId for update."); throw new Error("User ID required."); }
    if (!updates || Object.keys(updates).length === 0) { this.logger.warn(`Attempted to update user ${userId} with empty data.`); return; }

    try {
      // Repository's update will handle timestamps
      await this.userRepository.update(userId, updates);
      this.logger.log(`User profile updated for ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating user profile ${userId}`, error instanceof Error ? error.stack : undefined, { updates });
      // Optionally check if the error is due to the document not existing
       if ((error as any)?.code === 'not-found') {
            throw new NotFoundException(`User profile ${userId} not found for update.`);
       }
      throw new Error('Failed to update user profile.');
    }
  }
}
