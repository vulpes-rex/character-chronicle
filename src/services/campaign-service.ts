
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  or,
  orderBy,
  limit,
  setDoc,
} from 'firebase/firestore';
import type { Campaign, GameLogEntry, SourcePack, UserRole, Monster } from '@/lib/types'; // Added Monster type

const campaignsCollection = collection(db, 'campaigns');
const gameLogsCollection = collection(db, 'gameLogs');
const sourcePacksCollection = collection(db, 'sourcePacks');


// --- Campaign Management ---

/**
 * Creates a new campaign.
 * @param campaignData - Basic campaign info (name, description).
 * @param dmId - The User ID of the Dungeon Master creating the campaign.
 * @returns The ID of the newly created campaign.
 */
export async function createCampaign(campaignData: Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>, dmId: string): Promise<string> {
  if (!dmId) {
    throw new Error('Dungeon Master ID is required to create a campaign.');
  }
  try {
    const docRef = await addDoc(campaignsCollection, {
      ...campaignData,
      dmId: dmId,
      playerIds: [], // Starts empty
      characterIds: [], // Starts empty
      activeSourcePackIds: campaignData.activeSourcePackIds || ['srd'], // Use provided or default to SRD
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('Campaign created with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding campaign document: ', e);
    throw new Error('Failed to create campaign.');
  }
}

/**
 * Loads a specific campaign from Firestore.
 * @param campaignId - The ID of the campaign to load.
 * @returns The campaign data, or null if not found.
 */
export async function loadCampaign(campaignId: string): Promise<Campaign | null> {
  const campaignDocRef = doc(db, 'campaigns', campaignId);
  try {
    const docSnap = await getDoc(campaignDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as Campaign;
    } else {
      console.log(`No campaign found with ID: ${campaignId}`);
      return null;
    }
  } catch (e) {
    console.error(`Error getting campaign document ${campaignId}: `, e);
    throw new Error(`Failed to load campaign ${campaignId}.`);
  }
}

/**
 * Loads all campaigns where the given user is either the DM or a player.
 * @param userId - The ID of the user whose campaigns to load.
 * @param userRole - The role of the user ('dm' or 'player'). Optional, helps optimize query.
 * @returns An array of campaign data.
 */
export async function loadAllCampaigns(userId?: string, userRole?: UserRole): Promise<Campaign[]> {
    if (!userId) {
        // If no user ID is provided, return an empty array or handle as needed
        return [];
    }

    // Query for campaigns where the user is the DM OR the user is in the playerIds array
    const q = query(campaignsCollection,
        or(
            where('dmId', '==', userId),
            where('playerIds', 'array-contains', userId)
        )
    );

    try {
        const querySnapshot = await getDocs(q);
        const campaigns: Campaign[] = [];
        querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        campaigns.push({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
        } as Campaign);
        });
        return campaigns;
    } catch (e) {
        console.error('Error getting campaign documents: ', e);
        throw new Error('Failed to load campaigns.');
    }
}


/**
 * Updates specific fields of a campaign. Only the DM should be able to do this.
 * @param campaignId - The ID of the campaign to update.
 * @param campaignData - An object containing the fields to update (e.g., name, description).
 * @param currentUserId - The ID of the user attempting the update (for permission check).
 */
export async function updateCampaign(campaignId: string, campaignData: Partial<Pick<Campaign, 'name' | 'description' | 'activeSourcePackIds'>>, currentUserId: string): Promise<void> {
  const campaignDocRef = doc(db, 'campaigns', campaignId);

  // Permission Check (Example)
  const campaign = await loadCampaign(campaignId);
  if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
  }
  if (campaign.dmId !== currentUserId) {
      throw new Error('Permission denied: Only the DM can update the campaign.');
  }

  const dataToUpdate: Record<string, any> = {
    ...campaignData,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(campaignDocRef, dataToUpdate);
    console.log('Campaign updated with ID: ', campaignId);
  } catch (e) {
    console.error('Error updating campaign document: ', e);
    throw new Error('Failed to update campaign.');
  }
}

/**
 * Deletes a campaign. Only the DM should be able to do this.
 * @param campaignId - The ID of the campaign to delete.
 * @param currentUserId - The ID of the user attempting the delete (for permission check).
 */
export async function deleteCampaign(campaignId: string, currentUserId: string): Promise<void> {
   const campaignDocRef = doc(db, 'campaigns', campaignId);

   // Permission Check (Example)
   const campaign = await loadCampaign(campaignId);
    if (!campaign) {
        throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
   if (campaign.dmId !== currentUserId) {
       throw new Error('Permission denied: Only the DM can delete the campaign.');
   }

   // TODO: Consider implications - delete associated characters? game logs? encounters?
   // This currently only deletes the campaign document itself.

   try {
     await deleteDoc(campaignDocRef);
     console.log('Campaign deleted with ID: ', campaignId);
   } catch (e) {
     console.error('Error deleting campaign document: ', e);
     throw new Error('Failed to delete campaign.');
   }
}

/**
 * Adds a player to a campaign.
 * @param campaignId - The ID of the campaign.
 * @param playerId - The ID of the player user to add.
 * @param currentUserId - The ID of the user performing the action (should be DM).
 */
export async function addPlayerToCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
    const campaignDocRef = doc(db, 'campaigns', campaignId);

    // Permission Check (Example)
    const campaign = await loadCampaign(campaignId);
     if (!campaign) {
        throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
    if (campaign.dmId !== currentUserId) {
        throw new Error('Permission denied: Only the DM can add players.');
    }
    if (campaign.playerIds.includes(playerId)) {
         console.log(`Player ${playerId} already in campaign ${campaignId}.`);
         return; // Already exists
    }

    try {
        await updateDoc(campaignDocRef, {
            playerIds: arrayUnion(playerId),
            updatedAt: serverTimestamp(),
        });
        console.log(`Player ${playerId} added to campaign ${campaignId}`);
    } catch (e) {
        console.error('Error adding player to campaign:', e);
        throw new Error('Failed to add player.');
    }
}

/**
 * Removes a player from a campaign.
 * @param campaignId - The ID of the campaign.
 * @param playerId - The ID of the player user to remove.
 * @param currentUserId - The ID of the user performing the action (should be DM).
 */
export async function removePlayerFromCampaign(campaignId: string, playerId: string, currentUserId: string): Promise<void> {
    const campaignDocRef = doc(db, 'campaigns', campaignId);

    // Permission Check (Example)
    const campaign = await loadCampaign(campaignId);
     if (!campaign) {
        throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
    if (campaign.dmId !== currentUserId) {
        throw new Error('Permission denied: Only the DM can remove players.');
    }
     if (!campaign.playerIds.includes(playerId)) {
         console.log(`Player ${playerId} not found in campaign ${campaignId}.`);
         return; // Not in campaign
    }

    // TODO: Should removing a player also remove their character(s) from the campaign?
    // This currently only removes the player ID from the campaign's list.

    try {
        await updateDoc(campaignDocRef, {
            playerIds: arrayRemove(playerId),
            // Consider removing associated characterIds here if needed
            updatedAt: serverTimestamp(),
        });
        console.log(`Player ${playerId} removed from campaign ${campaignId}`);
    } catch (e) {
        console.error('Error removing player from campaign:', e);
        throw new Error('Failed to remove player.');
    }
}


// --- Game Log Management ---

/**
 * Adds an entry to the game log for a specific campaign.
 * @param logEntryData - The data for the log entry (excluding ID and timestamp).
 * @returns The ID of the newly created log entry.
 */
export async function addGameLogEntry(logEntryData: Omit<GameLogEntry, 'id' | 'timestamp'>): Promise<string> {
  try {
    const docRef = await addDoc(gameLogsCollection, {
      ...logEntryData,
      timestamp: serverTimestamp(),
    });
    console.log(`Game log entry added for campaign ${logEntryData.campaignId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (e) {
    console.error('Error adding game log entry:', e);
    throw new Error('Failed to add game log entry.');
  }
}

/**
 * Loads game log entries for a specific campaign, ordered by timestamp.
 * @param campaignId - The ID of the campaign whose log to load.
 * @param limitCount - Optional number of latest entries to retrieve.
 * @returns An array of game log entries.
 */
export async function loadGameLogEntries(campaignId: string, limitCount?: number): Promise<GameLogEntry[]> {
  let q = query(gameLogsCollection, where('campaignId', '==', campaignId), orderBy('timestamp', 'desc'));
  if (limitCount && limitCount > 0) {
      q = query(q, limit(limitCount));
  }

  try {
    const querySnapshot = await getDocs(q);
    const logEntries: GameLogEntry[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logEntries.push({
        id: docSnap.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
      } as GameLogEntry);
    });
    return logEntries.reverse(); // Reverse to show oldest first if needed, or keep descending for latest first
  } catch (e) {
    console.error('Error getting game log entries:', e);
    throw new Error('Failed to load game log.');
  }
}

// --- Source Pack Management (DM Only) ---

/**
 * Creates or updates a source pack.
 * @param sourcePackData - The source pack data (can include ID for updates).
 * @param currentUserId - The ID of the DM performing the action.
 * @returns The ID of the created/updated source pack.
 */
export async function saveSourcePack(sourcePackData: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string }, currentUserId: string): Promise<string> {
    if (!sourcePackData.id && sourcePackData.creatorId !== currentUserId && sourcePackData.creatorId !== 'system') {
        throw new Error('Permission denied: Cannot create source pack for another user.');
    }

    const docRef = sourcePackData.id ? doc(db, 'sourcePacks', sourcePackData.id) : doc(collection(db, 'sourcePacks'));

    if (sourcePackData.id) {
        // Check ownership if updating existing pack
        const existingPack = await loadSourcePack(sourcePackData.id);
        if (!existingPack) {
             throw new Error(`Source pack with ID ${sourcePackData.id} not found.`);
        }
        if (existingPack.creatorId !== currentUserId && existingPack.creatorId !== 'system') {
            throw new Error('Permission denied: Cannot update this source pack.');
        }
    }

    const dataToSave = {
        ...sourcePackData,
        creatorId: sourcePackData.creatorId || currentUserId, // Ensure creator is set
        updatedAt: serverTimestamp(),
        // Conditionally add createdAt only if it's a new document (no ID provided)
        ...(!sourcePackData.id && { createdAt: serverTimestamp() }),
    };
    // Remove the ID from the data being saved if it exists
    delete dataToSave.id;


    try {
        // Use set with merge: true for updates, default behavior creates if doesn't exist
        await setDoc(docRef, dataToSave, { merge: true });
        console.log('Source pack saved with ID:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('Error saving source pack:', e);
        throw new Error('Failed to save source pack.');
    }
}

/**
 * Loads a specific source pack.
 * @param sourcePackId - The ID of the source pack to load.
 * @returns The source pack data, or null if not found.
 */
export async function loadSourcePack(sourcePackId: string): Promise<SourcePack | null> {
    const packDocRef = doc(db, 'sourcePacks', sourcePackId);
    try {
        const docSnap = await getDoc(packDocRef);
        if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
        } as SourcePack;
        } else {
        console.log(`No source pack found with ID: ${sourcePackId}`);
        return null;
        }
    } catch (e) {
        console.error(`Error getting source pack document ${sourcePackId}: `, e);
        // Don't throw here, return null to allow graceful handling in combined content
        return null;
        // throw new Error('Failed to load source pack.');
    }
}


/**
 * Loads all source packs created by a specific DM or system packs.
 * @param creatorId - The ID of the DM or 'system'.
 * @returns An array of source pack data.
 */
export async function loadSourcePacksByCreator(creatorId: string): Promise<SourcePack[]> {
    const q = query(sourcePacksCollection, where('creatorId', '==', creatorId));
    try {
        const querySnapshot = await getDocs(q);
        const packs: SourcePack[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            packs.push({
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
            } as SourcePack);
        });
        return packs;
    } catch (e) {
        console.error('Error getting source packs:', e);
        throw new Error('Failed to load source packs.');
    }
}

/**
 * Deletes a source pack. Only the creator DM can delete their own packs.
 * @param sourcePackId - The ID of the source pack to delete.
 * @param currentUserId - The ID of the user attempting the delete.
 */
export async function deleteSourcePack(sourcePackId: string, currentUserId: string): Promise<void> {
    const packDocRef = doc(db, 'sourcePacks', sourcePackId);

    // Permission Check
    const pack = await loadSourcePack(sourcePackId);
     if (!pack) {
        throw new Error(`Source pack with ID ${sourcePackId} not found.`);
    }
    if (pack.creatorId === 'system' || pack.creatorId !== currentUserId) {
        throw new Error('Permission denied: Cannot delete this source pack.');
    }

    // TODO: Consider implications - remove from active campaigns?

    try {
        await deleteDoc(packDocRef);
        console.log('Source pack deleted with ID:', sourcePackId);
    } catch (e) {
        console.error('Error deleting source pack:', e);
        throw new Error('Failed to delete source pack.');
    }
}

// --- Helper to combine content from multiple source packs ---
// This would be used during character creation/viewing to get available options
export async function getCombinedContentFromPacks(packIds: string[]): Promise<SourcePack['content']> {
    const combinedContent: SourcePack['content'] = {
        races: {},
        classes: {},
        items: {},
        monsters: {}, // Initialize monsters
        backgrounds: {},
    };

    if (!packIds || packIds.length === 0) {
        packIds = ['srd']; // Default to SRD if no packs are specified
    }

    // Ensure SRD is always included if not already present
    const packIdsToLoad = [...new Set([...packIds, 'srd'])]; // Use Set to avoid duplicates

    const packPromises = packIdsToLoad.map(async (id) => {
         try {
            return await loadSourcePack(id);
         } catch (error) {
             console.warn(`Failed to load source pack ${id}:`, error);
             return null; // Return null if a pack fails to load
         }
    });

    const packs = (await Promise.all(packPromises)).filter((pack): pack is SourcePack => pack !== null); // Filter out nulls

    // Define the order of merging (SRD first, then others)
    const srdPack = packs.find(p => p.id === 'srd');
    const otherPacks = packs.filter(p => p.id !== 'srd');
    const sortedPacks = srdPack ? [srdPack, ...otherPacks] : otherPacks; // Put SRD first if found

    for (const pack of sortedPacks) {
        if (pack?.content) {
            // Merge content, SRD content will be potentially overwritten by custom packs loaded later
            combinedContent.races = { ...combinedContent.races, ...pack.content.races };
            combinedContent.classes = { ...combinedContent.classes, ...pack.content.classes };
            combinedContent.items = { ...combinedContent.items, ...pack.content.items };
            combinedContent.monsters = { ...combinedContent.monsters, ...pack.content.monsters }; // Merge monsters
            combinedContent.backgrounds = { ...combinedContent.backgrounds, ...pack.content.backgrounds };
            // Merge other content types (spells, etc.) if added
        }
    }

    return combinedContent;
}

    