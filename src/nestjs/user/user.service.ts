
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CollectionReference, Firestore, Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc, collection } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { LoggingService } from '@/nestjs/logging/logging.service';

@Injectable()
export class UserService {
  private readonly usersCollection: CollectionReference<Omit<UserProfile, 'id'>>;

  constructor(
    @Inject('FIRESTORE') private readonly firestore: Firestore,
    private readonly logger: LoggingService,
  ) {
    this.usersCollection = collection(this.firestore, 'users') as CollectionReference<Omit<UserProfile, 'id'>>;
    this.logger.setContext('UserService');
  }

  /** Loads a user profile from Firestore. */
  async loadUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) { this.logger.warn("loadUserProfile called with empty userId."); return null; }
    const userDocRef = doc(this.firestore, 'users', userId);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined, updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined } as UserProfile;
      } else { this.logger.log(`No profile found for user ID: ${userId}`); return null; }
    } catch (error) {
      this.logger.error(`Error loading user profile ${userId}`, error instanceof Error ? error.stack : undefined);
      throw new Error('Failed to load user profile.');
    }
  }

  /** Creates a new user profile in Firestore. */
  async createUserProfile(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    if (!profileData || !profileData.id) { this.logger.error("Missing required profile data or user ID."); throw new Error("Invalid user profile data for creation."); }
    const userDocRef = doc(this.firestore, 'users', profileData.id);
    const dataToSave = { ...profileData, role: profileData.role || 'player', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    try {
      await setDoc(userDocRef, dataToSave, { merge: false }); // Don't merge on create
      this.logger.log(`User profile created for ID: ${profileData.id}`);
      return { ...profileData, role: dataToSave.role, createdAt: new Date(), updatedAt: new Date() }; // Return with approximate dates
    } catch (error) {
      this.logger.error(`Error creating user profile ${profileData.id}`, error instanceof Error ? error.stack : undefined, { email: profileData.email, role: profileData.role });
      throw new Error('Failed to create user profile.');
    }
  }

  /** Updates specific fields of a user profile. */
  async updateUserProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'role'>>): Promise<void> {
    if (!userId) { this.logger.error("Missing userId for update."); throw new Error("User ID required."); }
    if (!updates || Object.keys(updates).length === 0) { this.logger.warn(`Attempted to update user ${userId} with empty data.`); return; }
    const userDocRef = doc(this.firestore, 'users', userId);
    const dataToUpdate = { ...updates, updatedAt: serverTimestamp() };
    try {
      // Optionally check if user exists before updating
      // const user = await this.loadUserProfile(userId);
      // if (!user) throw new NotFoundException(`User ${userId} not found.`);
      await updateDoc(userDocRef, dataToUpdate);
      this.logger.log(`User profile updated for ID: ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating user profile ${userId}`, error instanceof Error ? error.stack : undefined, { updates });
      throw new Error('Failed to update user profile.');
    }
  }
}
