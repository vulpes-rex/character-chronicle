
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
    throw new Error('Campaign ID is required to save an encounter.');
  }

  // Permission Check: Ensure the user is the DM of the associated campaign
  let campaign;
  try {
    campaign = await loadCampaign(encounterData.campaignId);
  } catch (error) {
    console.error(`Failed to load campaign ${encounterData.campaignId} for permission check:`, error);
    throw new Error(`Failed to verify campaign ownership. Could not load campaign ${encounterData.campaignId}.`);
  }

  if (!campaign) {
     throw new Error(`Campaign with ID ${encounterData.campaignId} not found. Cannot save encounter.`);
  }
  if (campaign.dmId !== dmUserId) {
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
    console.error(`Error saving encounter ${docRef.id}:`, e);
    throw new Error(`Failed to save encounter ${encounterData.name || 'Unnamed'}.`);
  }
}

/**
 * Loads a specific encounter from Firestore.
 * @param encounterId - The ID of the encounter to load.
 * @returns The encounter data, or null if not found.
 */
export async function loadEncounter(encounterId: string): Promise<Encounter | null> {
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
    console.error(`Error getting encounter document ${encounterId}: `, e);
    throw new Error(`Failed to load encounter ${encounterId}.`);
  }
}

/**
 * Loads all encounters associated with campaigns run by a specific DM.
 * @param dmUserId - The ID of the Dungeon Master.
 * @returns An array of encounter data.
 */
export async function loadAllEncounters(dmUserId: string): Promise<Encounter[]> {
  // 1. Find campaigns run by this DM
  let campaignIds: string[] = [];
  try {
      const campaignsQuery = query(collection(db, 'campaigns'), where('dmId', '==', dmUserId));
      const campaignSnapshot = await getDocs(campaignsQuery);
      campaignIds = campaignSnapshot.docs.map(doc => doc.id);
  } catch (error) {
      console.error(`Failed to load campaigns for DM ${dmUserId}:`, error);
      throw new Error(`Failed to load campaigns for DM.`);
  }


  if (campaignIds.length === 0) {
    return []; // No campaigns, so no encounters
  }

  // 2. Find encounters belonging to those campaigns
  // Firestore 'in' query limit is 30 - handle pagination or chunking if needed for more campaigns
  if (campaignIds.length > 30) {
      console.warn("Querying encounters for more than 30 campaigns, results might be incomplete due to Firestore limits.");
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
    console.error('Error getting encounter documents:', e);
    throw new Error('Failed to load encounters.');
  }
}

/**
 * Deletes an encounter. Only the DM of the associated campaign can delete it.
 * @param encounterId - The ID of the encounter to delete.
 * @param dmUserId - The ID of the user attempting the delete.
 */
export async function deleteEncounter(encounterId: string, dmUserId: string): Promise<void> {
  const encounterDocRef = doc(db, 'encounters', encounterId);

  // Permission Check
  let encounter: Encounter | null = null;
  try {
      encounter = await loadEncounter(encounterId);
  } catch (error) {
      throw new Error(`Failed to load encounter ${encounterId} for deletion check.`);
  }

  if (!encounter) {
    throw new Error(`Encounter with ID ${encounterId} not found.`);
  }

   let campaign;
   try {
     campaign = await loadCampaign(encounter.campaignId);
   } catch (error) {
     throw new Error(`Failed to load campaign ${encounter.campaignId} for permission check during encounter deletion.`);
   }

  if (!campaign) {
      throw new Error(`Campaign with ID ${encounter.campaignId} not found for encounter ${encounterId}. Cannot verify permissions.`);
  }
  if (campaign.dmId !== dmUserId) {
    throw new Error('Permission denied: Only the campaign DM can delete this encounter.');
  }

  try {
    await deleteDoc(encounterDocRef);
    console.log('Encounter deleted with ID:', encounterId);
  } catch (e) {
    console.error(`Error deleting encounter document ${encounterId}:`, e);
    throw new Error(`Failed to delete encounter ${encounterId}.`);
  }
}
