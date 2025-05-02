
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
import type { Campaign, GameLogEntry, SourcePack, UserRole, Monster, NPC } from '@/lib/types'; // Added NPC type

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
    console.error("createCampaign: Attempted to create campaign without a DM ID.");
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
    // Enhanced Logging
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Error in createCampaign for DM ${dmId}: Firestore operation failed.`, {
        errorMessage: error.message,
        errorStack: error.stack,
        dmId: dmId,
        campaignData: { name: campaignData.name } // Log partial data
    });
    throw new Error('Failed to create campaign.');
  }
}

/**
 * Loads a specific campaign from Firestore.
 * @param campaignId - The ID of the campaign to load.
 * @returns The campaign data, or null if not found.
 */
export async function loadCampaign(campaignId: string): Promise<Campaign | null> {
  if (!campaignId) {
    console.warn("loadCampaign: Attempted to load campaign with empty ID.");
    return null;
  }
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
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in loadCampaign for ID ${campaignId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         campaignId: campaignId,
     });
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
        console.warn("loadAllCampaigns: Called without userId.");
        return [];
    }

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
         // Enhanced Logging
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Error in loadAllCampaigns for user ${userId}: Firestore operation failed.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            userId: userId,
            userRole: userRole
        });
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
  if (!campaignId || !currentUserId) {
     console.error("updateCampaign: Missing campaignId or currentUserId.");
     throw new Error("Missing required parameters for campaign update.");
  }
  const campaignDocRef = doc(db, 'campaigns', campaignId);

  try {
      const campaign = await loadCampaign(campaignId);
      if (!campaign) {
          console.error(`updateCampaign: Campaign with ID ${campaignId} not found.`);
          throw new Error(`Campaign with ID ${campaignId} not found.`);
      }
      if (campaign.dmId !== currentUserId) {
           console.warn(`updateCampaign: Permission denied for user ${currentUserId} to update campaign ${campaignId} owned by ${campaign.dmId}.`);
          throw new Error('Permission denied: Only the DM can update the campaign.');
      }

      const dataToUpdate: Record<string, any> = {
        ...campaignData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(campaignDocRef, dataToUpdate);
      console.log('Campaign updated with ID: ', campaignId);
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in updateCampaign for ID ${campaignId} by user ${currentUserId}: Firestore operation failed or permission error.`, {
        errorMessage: error.message,
        errorStack: error.stack,
        campaignId: campaignId,
        currentUserId: currentUserId,
        updateDataKeys: Object.keys(campaignData)
     });
    // Re-throw specific permission error or generic failure
    if (error.message.startsWith('Permission denied')) {
         throw error;
    }
    throw new Error('Failed to update campaign.');
  }
}

/**
 * Deletes a campaign. Only the DM should be able to do this.
 * @param campaignId - The ID of the campaign to delete.
 * @param currentUserId - The ID of the user attempting the delete (for permission check).
 */
export async function deleteCampaign(campaignId: string, currentUserId: string): Promise<void> {
    if (!campaignId || !currentUserId) {
       console.error("deleteCampaign: Missing campaignId or currentUserId.");
       throw new Error("Missing required parameters for campaign deletion.");
    }
   const campaignDocRef = doc(db, 'campaigns', campaignId);

   try {
       const campaign = await loadCampaign(campaignId);
       if (!campaign) {
            console.error(`deleteCampaign: Campaign with ID ${campaignId} not found.`);
           throw new Error(`Campaign with ID ${campaignId} not found.`);
       }
       if (campaign.dmId !== currentUserId) {
            console.warn(`deleteCampaign: Permission denied for user ${currentUserId} to delete campaign ${campaignId} owned by ${campaign.dmId}.`);
           throw new Error('Permission denied: Only the DM can delete the campaign.');
       }

       await deleteDoc(campaignDocRef);
       console.log('Campaign deleted with ID: ', campaignId);
   } catch (e) {
        // Enhanced Logging
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Error in deleteCampaign for ID ${campaignId} by user ${currentUserId}: Firestore operation failed or permission error.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            campaignId: campaignId,
            currentUserId: currentUserId,
        });
         if (error.message.startsWith('Permission denied')) {
            throw error;
        }
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
    if (!campaignId || !playerId || !currentUserId) {
       console.error("addPlayerToCampaign: Missing campaignId, playerId, or currentUserId.");
       throw new Error("Missing required parameters for adding player.");
    }
    const campaignDocRef = doc(db, 'campaigns', campaignId);

    try {
        const campaign = await loadCampaign(campaignId);
        if (!campaign) {
             console.error(`addPlayerToCampaign: Campaign with ID ${campaignId} not found.`);
            throw new Error(`Campaign with ID ${campaignId} not found.`);
        }
        if (campaign.dmId !== currentUserId) {
             console.warn(`addPlayerToCampaign: Permission denied for user ${currentUserId} to add player to campaign ${campaignId} owned by ${campaign.dmId}.`);
            throw new Error('Permission denied: Only the DM can add players.');
        }
        if (campaign.playerIds.includes(playerId)) {
            console.log(`Player ${playerId} already in campaign ${campaignId}.`);
            return;
        }

        await updateDoc(campaignDocRef, {
            playerIds: arrayUnion(playerId),
            updatedAt: serverTimestamp(),
        });
        console.log(`Player ${playerId} added to campaign ${campaignId}`);
    } catch (e) {
         // Enhanced Logging
         const error = e instanceof Error ? e : new Error(String(e));
         console.error(`Error in addPlayerToCampaign (Campaign: ${campaignId}, Player: ${playerId}, User: ${currentUserId}): Firestore operation failed or permission error.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            campaignId: campaignId,
            playerId: playerId,
            currentUserId: currentUserId,
         });
         if (error.message.startsWith('Permission denied')) {
            throw error;
        }
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
     if (!campaignId || !playerId || !currentUserId) {
       console.error("removePlayerFromCampaign: Missing campaignId, playerId, or currentUserId.");
       throw new Error("Missing required parameters for removing player.");
    }
    const campaignDocRef = doc(db, 'campaigns', campaignId);

    try {
        const campaign = await loadCampaign(campaignId);
        if (!campaign) {
            console.error(`removePlayerFromCampaign: Campaign with ID ${campaignId} not found.`);
            throw new Error(`Campaign with ID ${campaignId} not found.`);
        }
        if (campaign.dmId !== currentUserId) {
             console.warn(`removePlayerFromCampaign: Permission denied for user ${currentUserId} to remove player from campaign ${campaignId} owned by ${campaign.dmId}.`);
            throw new Error('Permission denied: Only the DM can remove players.');
        }
        if (!campaign.playerIds.includes(playerId)) {
            console.log(`Player ${playerId} not found in campaign ${campaignId}.`);
            return;
        }

        await updateDoc(campaignDocRef, {
            playerIds: arrayRemove(playerId),
            updatedAt: serverTimestamp(),
        });
        console.log(`Player ${playerId} removed from campaign ${campaignId}`);
    } catch (e) {
         // Enhanced Logging
         const error = e instanceof Error ? e : new Error(String(e));
         console.error(`Error in removePlayerFromCampaign (Campaign: ${campaignId}, Player: ${playerId}, User: ${currentUserId}): Firestore operation failed or permission error.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            campaignId: campaignId,
            playerId: playerId,
            currentUserId: currentUserId,
         });
        if (error.message.startsWith('Permission denied')) {
            throw error;
        }
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
   if (!logEntryData || !logEntryData.campaignId) {
       console.error("addGameLogEntry: Missing log entry data or campaignId.");
       throw new Error("Invalid log entry data provided.");
   }
  try {
    const docRef = await addDoc(gameLogsCollection, {
      ...logEntryData,
      timestamp: serverTimestamp(),
    });
    // console.log(`Game log entry added for campaign ${logEntryData.campaignId} with ID: ${docRef.id}`); // Reduce log noise
    return docRef.id;
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in addGameLogEntry for campaign ${logEntryData.campaignId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         campaignId: logEntryData.campaignId,
         actorId: logEntryData.actorId,
         actionType: logEntryData.actionType,
     });
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
  if (!campaignId) {
     console.warn("loadGameLogEntries: Attempted to load logs with empty campaignId.");
     return [];
  }
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
    return logEntries.reverse();
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in loadGameLogEntries for campaign ${campaignId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         campaignId: campaignId,
         limitCount: limitCount,
     });
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
    if (!currentUserId) {
        console.error("saveSourcePack: Missing currentUserId.");
        throw new Error("User ID is required to save a source pack.");
    }
    if (!sourcePackData || !sourcePackData.name) {
        console.error("saveSourcePack: Missing required pack data (e.g., name).");
        throw new Error("Source pack name is required.");
    }

    const docRef = sourcePackData.id ? doc(db, 'sourcePacks', sourcePackData.id) : doc(collection(db, 'sourcePacks'));

    try {
        if (sourcePackData.id) {
            const existingPack = await loadSourcePack(sourcePackData.id);
            if (!existingPack) {
                console.error(`saveSourcePack: Source pack with ID ${sourcePackData.id} not found for update.`);
                throw new Error(`Source pack with ID ${sourcePackData.id} not found.`);
            }
            if (existingPack.creatorId !== currentUserId && existingPack.creatorId !== 'system') {
                 console.warn(`saveSourcePack: Permission denied for user ${currentUserId} to update pack ${sourcePackData.id} owned by ${existingPack.creatorId}.`);
                throw new Error('Permission denied: Cannot update this source pack.');
            }
        } else if (sourcePackData.creatorId && sourcePackData.creatorId !== currentUserId && sourcePackData.creatorId !== 'system') {
             console.warn(`saveSourcePack: Permission denied for user ${currentUserId} to create pack with creatorId ${sourcePackData.creatorId}.`);
             throw new Error('Permission denied: Cannot create source pack for another user.');
        }

        const dataToSave = {
            ...sourcePackData,
            creatorId: sourcePackData.creatorId || currentUserId,
            updatedAt: serverTimestamp(),
            ...(!sourcePackData.id && { createdAt: serverTimestamp() }),
        };
        delete dataToSave.id;

        await setDoc(docRef, dataToSave, { merge: true });
        console.log('Source pack saved with ID:', docRef.id);
        return docRef.id;
    } catch (e) {
         // Enhanced Logging
         const error = e instanceof Error ? e : new Error(String(e));
         console.error(`Error in saveSourcePack (Pack ID: ${sourcePackData.id || 'new'}, User: ${currentUserId}): Firestore operation failed or permission error.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            packId: sourcePackData.id || 'new',
            currentUserId: currentUserId,
         });
         if (error.message.startsWith('Permission denied')) {
            throw error;
         }
        throw new Error('Failed to save source pack.');
    }
}

/**
 * Loads a specific source pack.
 * @param sourcePackId - The ID of the source pack to load.
 * @returns The source pack data, or null if not found.
 */
export async function loadSourcePack(sourcePackId: string): Promise<SourcePack | null> {
    if (!sourcePackId) {
        console.warn("loadSourcePack: Attempted to load pack with empty ID.");
        return null;
    }
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
        // Enhanced Logging
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Error in loadSourcePack for ID ${sourcePackId}: Firestore operation failed.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            packId: sourcePackId,
        });
        // Don't throw here for getCombinedContentFromPacks
        return null;
    }
}


/**
 * Loads all source packs created by a specific DM or system packs.
 * @param creatorId - The ID of the DM or 'system'.
 * @returns An array of source pack data.
 */
export async function loadSourcePacksByCreator(creatorId: string): Promise<SourcePack[]> {
     if (!creatorId) {
        console.warn("loadSourcePacksByCreator: Attempted to load packs with empty creatorId.");
        return [];
    }
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
        // Enhanced Logging
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Error in loadSourcePacksByCreator for creator ${creatorId}: Firestore operation failed.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            creatorId: creatorId,
        });
        throw new Error('Failed to load source packs.');
    }
}

/**
 * Deletes a source pack. Only the creator DM can delete their own packs.
 * @param sourcePackId - The ID of the source pack to delete.
 * @param currentUserId - The ID of the user attempting the delete.
 */
export async function deleteSourcePack(sourcePackId: string, currentUserId: string): Promise<void> {
    if (!sourcePackId || !currentUserId) {
       console.error("deleteSourcePack: Missing sourcePackId or currentUserId.");
       throw new Error("Missing required parameters for source pack deletion.");
    }
    const packDocRef = doc(db, 'sourcePacks', sourcePackId);

    try {
        const pack = await loadSourcePack(sourcePackId);
        if (!pack) {
            console.error(`deleteSourcePack: Source pack with ID ${sourcePackId} not found.`);
            throw new Error(`Source pack with ID ${sourcePackId} not found.`);
        }
        if (pack.creatorId === 'system') {
             console.warn(`deleteSourcePack: Attempt by user ${currentUserId} to delete system pack ${sourcePackId}.`);
            throw new Error('Permission denied: Cannot delete system source packs.');
        }
        if (pack.creatorId !== currentUserId) {
             console.warn(`deleteSourcePack: Permission denied for user ${currentUserId} to delete pack ${sourcePackId} owned by ${pack.creatorId}.`);
            throw new Error('Permission denied: Cannot delete this source pack.');
        }

        await deleteDoc(packDocRef);
        console.log('Source pack deleted with ID:', sourcePackId);
    } catch (e) {
         // Enhanced Logging
         const error = e instanceof Error ? e : new Error(String(e));
         console.error(`Error in deleteSourcePack (Pack ID: ${sourcePackId}, User: ${currentUserId}): Firestore operation failed or permission error.`, {
            errorMessage: error.message,
            errorStack: error.stack,
            packId: sourcePackId,
            currentUserId: currentUserId,
         });
         if (error.message.startsWith('Permission denied')) {
            throw error;
         }
        throw new Error('Failed to delete source pack.');
    }
}

// --- Helper to combine content from multiple source packs ---
export async function getCombinedContentFromPacks(packIds: string[]): Promise<SourcePack['content']> {
    const combinedContent: SourcePack['content'] = {
        races: {},
        classes: {},
        items: {},
        monsters: {},
        npcs: {},
        backgrounds: {},
    };

    if (!packIds || packIds.length === 0) {
        console.log("getCombinedContentFromPacks: No pack IDs provided, defaulting to 'srd'.");
        packIds = ['srd'];
    }

    const packIdsToLoad = [...new Set([...packIds, 'srd'])];

    const packPromises = packIdsToLoad.map(async (id) => {
         try {
            const pack = await loadSourcePack(id);
             if (!pack) {
                 console.warn(`getCombinedContentFromPacks: Failed to load source pack ${id} (returned null).`);
             }
            return pack;
         } catch (error) {
             // Error is already logged in loadSourcePack
             return null;
         }
    });

    const packs = (await Promise.all(packPromises)).filter((pack): pack is SourcePack => pack !== null);

    const srdPack = packs.find(p => p.id === 'srd');
    const otherPacks = packs.filter(p => p.id !== 'srd');
    const sortedPacks = srdPack ? [srdPack, ...otherPacks] : otherPacks;

    for (const pack of sortedPacks) {
        if (pack?.content) {
             try {
                 combinedContent.races = { ...combinedContent.races, ...pack.content.races };
                 combinedContent.classes = { ...combinedContent.classes, ...pack.content.classes };
                 combinedContent.items = { ...combinedContent.items, ...pack.content.items };
                 combinedContent.monsters = { ...combinedContent.monsters, ...pack.content.monsters };
                 combinedContent.npcs = { ...combinedContent.npcs, ...pack.content.npcs };
                 combinedContent.backgrounds = { ...combinedContent.backgrounds, ...pack.content.backgrounds };
             } catch (mergeError) {
                 const error = mergeError instanceof Error ? mergeError : new Error(String(mergeError));
                 console.error(`Error merging content from pack ${pack.id} (${pack.name}):`, {
                     errorMessage: error.message,
                     errorStack: error.stack,
                     packId: pack.id,
                     packName: pack.name,
                 });
                 // Decide how to handle merge errors: continue, stop, etc.
             }
        }
    }

    return combinedContent;
}
