
'use server'; // Indicate this module can contain server-only logic (like direct DB access)

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
} from 'firebase/firestore';
import type { Character } from '@/lib/types';

const charactersCollection = collection(db, 'characters');

/**
 * Saves a new character to Firestore.
 * @param characterData - The character data to save (without ID).
 * @returns The ID of the newly created character.
 */
export async function saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!characterData || !characterData.characterName || !characterData.playerName) {
      console.error("saveCharacter: Attempted to save character with missing core data.");
      throw new Error("Missing required character data (e.g., character name, player name).");
  }
  try {
    const docRef = await addDoc(charactersCollection, {
      ...characterData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('Character saved with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    // Enhanced Logging
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Error in saveCharacter for ${characterData.characterName}: Firestore operation failed.`, {
        errorMessage: error.message,
        errorStack: error.stack,
        characterData: { // Log partial data for debugging (avoid sensitive info if needed)
            characterName: characterData.characterName,
            playerName: characterData.playerName,
            race: characterData.race,
            class: characterData.class,
        }
    });
    throw new Error('Failed to save character.');
  }
}

/**
 * Updates an existing character in Firestore.
 * @param characterId - The ID of the character to update.
 * @param characterData - The character data fields to update.
 */
export async function updateCharacter(characterId: string, characterData: Partial<Omit<Character, 'id' | 'createdAt'>>): Promise<void> {
  if (!characterId) {
      console.error("updateCharacter: Attempted to update character with missing ID.");
      throw new Error("Character ID is required for update.");
  }
   if (!characterData || Object.keys(characterData).length === 0) {
      console.warn(`updateCharacter: Attempted to update character ${characterId} with empty data.`);
      return; // No changes to apply
  }
  const characterDoc = doc(db, 'characters', characterId);
  try {
    await updateDoc(characterDoc, {
      ...characterData,
      updatedAt: serverTimestamp(),
    });
    console.log('Character updated with ID: ', characterId);
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in updateCharacter for ID ${characterId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         characterId: characterId,
         updateDataKeys: Object.keys(characterData) // Log keys being updated
     });
    throw new Error('Failed to update character.');
  }
}

/**
 * Loads a specific character from Firestore.
 * @param characterId - The ID of the character to load.
 * @returns The character data, or null if not found.
 */
export async function loadCharacter(characterId: string): Promise<Character | null> {
   if (!characterId) {
       console.warn("loadCharacter: Attempted to load character with empty ID.");
       return null;
   }
  const characterDoc = doc(db, 'characters', characterId);
  try {
    const docSnap = await getDoc(characterDoc);
    if (docSnap.exists()) {
        const data = docSnap.data();
         // Convert Firestore Timestamps to Dates if they exist
        const character: Character = {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
        } as Character; // Cast might be needed depending on strictness
      return character;
    } else {
      console.log(`No character document found for ID: ${characterId}`);
      return null;
    }
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in loadCharacter for ID ${characterId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         characterId: characterId,
     });
    throw new Error('Failed to load character.');
  }
}

/**
 * Loads all characters (or potentially characters for a specific player if auth is added).
 * @returns An array of all character data.
 */
export async function loadAllCharacters(): Promise<Character[]> {
  // TODO: Add filtering by player ID if authentication is implemented
  const q = query(charactersCollection); // Simple query for all characters for now
  try {
    const querySnapshot = await getDocs(q);
    const characters: Character[] = [];
    querySnapshot.forEach((docSnap) => {
       const data = docSnap.data();
        // Convert Firestore Timestamps to Dates
        characters.push({
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
        } as Character); // Cast might be needed
    });
    return characters;
  } catch (e) {
    // Enhanced Logging
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error in loadAllCharacters: Firestore operation failed.', {
        errorMessage: error.message,
        errorStack: error.stack,
    });
    throw new Error('Failed to load characters.');
  }
}

/**
 * Deletes a character from Firestore.
 * @param characterId - The ID of the character to delete.
 */
export async function deleteCharacter(characterId: string): Promise<void> {
   if (!characterId) {
       console.error("deleteCharacter: Attempted to delete character with missing ID.");
       throw new Error("Character ID is required for deletion.");
   }
  const characterDoc = doc(db, 'characters', characterId);
  try {
    await deleteDoc(characterDoc);
    console.log('Character deleted with ID: ', characterId);
  } catch (e) {
     // Enhanced Logging
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in deleteCharacter for ID ${characterId}: Firestore operation failed.`, {
         errorMessage: error.message,
         errorStack: error.stack,
         characterId: characterId,
     });
    throw new Error('Failed to delete character.');
  }
}
