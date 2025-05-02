
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import type { Encounter, NPC } from '@/lib/types'; // Added NPC type
import { loadCampaign } from './campaign-service'; // To check permissions

const encountersCollection = collection(db, 'encounters');

/**
 * Saves a new encounter or updates an existing one.
 * Requires DM permission based on the associated campaign.
 * @param encounterData - The encounter data (must include campaignId). Can include ID for updates.
 * @param dmUserId - The ID of the user performing the action (must be the DM of the campaign).
 * @returns The ID of the created/updated encounter.
 */
export async function saveEncounter(encounterData: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string }, dmUserId: string): Promise<string> {
  if (!encounterData.campaignId) {
    console.error("saveEncounter: Missing campaignId.");
    throw new Error('Campaign ID is required to save an encounter.');
  }
   if (!dmUserId) {
    console.error("saveEncounter: Missing dmUserId for permission check.");
    throw new Error('DM User ID is required to save an encounter.');
  }

  let campaign;
  try {
    // Permission Check: Ensure the user is the DM of the associated campaign
    campaign = await loadCampaign(encounterData.campaignId);
  } catch (error) {
    console.error(`saveEncounter: Failed to load campaign ${encounterData.campaignId} for permission check:`, error);
    throw new Error(`Failed to verify campaign ownership. Could not load campaign ${encounterData.campaignId}.`);
  }

  if (!campaign) {
     console.error(`saveEncounter: Campaign with ID ${encounterData.campaignId} not found.`);
     throw new Error(`Campaign with ID ${encounterData.campaignId} not found. Cannot save encounter.`);
  }
  if (campaign.dmId !== dmUserId) {
    console.warn(`saveEncounter: Permission denied for user ${dmUserId} to save encounter for campaign ${encounterData.campaignId} owned by ${campaign.dmId}.`);
    throw new Error('Permission denied: Only the campaign DM can save encounters for this campaign.');
  }

  const docRef = encounterData.id ? doc(db, 'encounters', encounterData.id) : doc(collection(db, 'encounters'));

  const dataToSave = {
    ...encounterData,
    updatedAt: serverTimestamp(),
    // Conditionally add createdAt only if it's a new document
    ...(!encounterData.id && { createdAt: serverTimestamp() }),
  };
  // Remove the ID from the data being saved if it exists (Firestore handles ID separately)
  delete dataToSave.id;

  try {
    // Use setDoc with merge: true to create or completely overwrite/update
    await setDoc(docRef, dataToSave, { merge: true });
    console.log('Encounter saved with ID:', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error(`Error in saveEncounter (ID: ${docRef.id}, Campaign: ${encounterData.campaignId}, User: ${dmUserId}):`, e);
    throw new Error(`Failed to save encounter ${encounterData.name || 'Unnamed'}.`);
  }
}

/**
 * Loads a specific encounter from Firestore.
 * @param encounterId - The ID of the encounter to load.
 * @returns The encounter data, or null if not found.
 */
export async function loadEncounter(encounterId: string): Promise<Encounter | null> {
   if (!encounterId) {
       console.warn("loadEncounter: Attempted to load encounter with empty ID.");
       return null;
   }
  const encounterDocRef = doc(db, 'encounters', encounterId);
  try {
    const docSnap = await getDoc(encounterDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as Encounter;
    } else {
      console.log(`No encounter found with ID: ${encounterId}`);
      return null;
    }
  } catch (e) {
    console.error(`Error in loadEncounter for ID ${encounterId}: `, e);
    throw new Error(`Failed to load encounter ${encounterId}.`);
  }
}

/**
 * Loads all encounters associated with campaigns run by a specific DM.
 * @param dmUserId - The ID of the Dungeon Master.
 * @returns An array of encounter data.
 */
export async function loadAllEncounters(dmUserId: string): Promise<Encounter[]> {
   if (!dmUserId) {
       console.warn("loadAllEncounters: Attempted to load encounters with empty dmUserId.");
       return [];
   }
  // 1. Find campaigns run by this DM
  let campaignIds: string[] = [];
  try {
      const campaignsQuery = query(collection(db, 'campaigns'), where('dmId', '==', dmUserId));
      const campaignSnapshot = await getDocs(campaignsQuery);
      campaignIds = campaignSnapshot.docs.map(doc => doc.id);
  } catch (error) {
      console.error(`Error in loadAllEncounters: Failed to load campaigns for DM ${dmUserId}:`, error);
      throw new Error(`Failed to load campaigns for DM.`);
  }


  if (campaignIds.length === 0) {
    console.log(`loadAllEncounters: No campaigns found for DM ${dmUserId}.`);
    return []; // No campaigns, so no encounters
  }

  // 2. Find encounters belonging to those campaigns
  // Firestore 'in' query limit is 30 - handle pagination or chunking if needed for more campaigns
  if (campaignIds.length > 30) {
      console.warn(`loadAllEncounters: Querying encounters for more than 30 campaigns for DM ${dmUserId}, results might be incomplete due to Firestore limits.`);
      // Implement chunking logic here if necessary by breaking campaignIds into chunks of 30
      // and running multiple queries.
      // Example: const chunks = chunkArray(campaignIds, 30);
      // For now, we'll proceed with the first 30.
      campaignIds = campaignIds.slice(0, 30);
  }

  if (campaignIds.length === 0) { // Check again in case slicing resulted in empty
      return [];
  }

  const encountersQuery = query(encountersCollection, where('campaignId', 'in', campaignIds));
  try {
    const querySnapshot = await getDocs(encountersQuery);
    const encounters: Encounter[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      encounters.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
      } as Encounter);
    });
    // Optional: Sort encounters, e.g., by update time descending
    encounters.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
    return encounters;
  } catch (e) {
    console.error(`Error in loadAllEncounters: Failed to get encounter documents for DM ${dmUserId}:`, e);
    throw new Error('Failed to load encounters.');
  }
}

/**
 * Deletes an encounter. Only the DM of the associated campaign can delete it.
 * @param encounterId - The ID of the encounter to delete.
 * @param dmUserId - The ID of the user attempting the delete.
 */
export async function deleteEncounter(encounterId: string, dmUserId: string): Promise<void> {
   if (!encounterId || !dmUserId) {
       console.error("deleteEncounter: Missing encounterId or dmUserId.");
       throw new Error("Missing required parameters for encounter deletion.");
   }
  const encounterDocRef = doc(db, 'encounters', encounterId);

  // Permission Check
  let encounter: Encounter | null = null;
  try {
      encounter = await loadEncounter(encounterId);
       if (!encounter) {
           console.error(`deleteEncounter: Encounter with ID ${encounterId} not found.`);
           throw new Error(`Encounter with ID ${encounterId} not found.`);
       }
  } catch (error) {
     console.error(`Error in deleteEncounter: Failed loading encounter ${encounterId} for check:`, error);
      throw new Error(`Failed to load encounter ${encounterId} for deletion check.`);
  }

   let campaign;
   try {
     campaign = await loadCampaign(encounter.campaignId);
      if (!campaign) {
          console.error(`deleteEncounter: Campaign with ID ${encounter.campaignId} not found for encounter ${encounterId}.`);
          throw new Error(`Campaign with ID ${encounter.campaignId} not found for encounter ${encounterId}. Cannot verify permissions.`);
      }
   } catch (error) {
     console.error(`Error in deleteEncounter: Failed loading campaign ${encounter.campaignId} for check:`, error);
     throw new Error(`Failed to load campaign ${encounter.campaignId} for permission check during encounter deletion.`);
   }

  if (campaign.dmId !== dmUserId) {
    console.warn(`deleteEncounter: Permission denied for user ${dmUserId} to delete encounter ${encounterId} (Campaign: ${encounter.campaignId}).`);
    throw new Error('Permission denied: Only the campaign DM can delete this encounter.');
  }

  try {
    await deleteDoc(encounterDocRef);
    console.log('Encounter deleted with ID:', encounterId);
  } catch (e) {
    console.error(`Error in deleteEncounter for ID ${encounterId} by user ${dmUserId}:`, e);
    throw new Error(`Failed to delete encounter ${encounterId}.`);
  }
}
