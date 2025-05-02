
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
import type { Character, Feature, FeatureEffectMetadata, EquipmentItem } from '@/lib/types'; // Import new types
import { logError, logMessage } from './logging-service'; // Import logging service
import { applyFeatureRules } from './feature-service'; // Import the new rule-based function

const charactersCollection = collection(db, 'characters');

/**
 * Saves a new character to Firestore.
 * @param characterData - The character data to save (without ID).
 * @returns The ID of the newly created character.
 */
export async function saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!characterData || !characterData.characterName || !characterData.playerName) {
      const errorMsg = "Attempted to save character with missing core data.";
      console.error("saveCharacter:", errorMsg);
      await logError(new Error(errorMsg), { function: 'saveCharacter', characterName: characterData?.characterName });
      throw new Error("Missing required character data (e.g., character name, player name).");
  }
  try {
    // Save the base data as provided by the creation wizard.
    // Derived stats (after applying features) are typically handled on load/display.
    const docRef = await addDoc(charactersCollection, {
      ...characterData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('Character saved with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Error in saveCharacter for ${characterData.characterName}: Firestore operation failed.`, error);
    await logError(error, {
        function: 'saveCharacter',
        characterName: characterData.characterName,
        playerName: characterData.playerName,
        race: characterData.race,
        class: characterData.class,
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
      const errorMsg = "Attempted to update character with missing ID.";
      console.error("updateCharacter:", errorMsg);
       await logError(new Error(errorMsg), { function: 'updateCharacter' });
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
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in updateCharacter for ID ${characterId}: Firestore operation failed.`, error);
     await logError(error, {
         function: 'updateCharacter',
         characterId: characterId,
         updateDataKeys: Object.keys(characterData),
     });
    throw new Error('Failed to update character.');
  }
}

/**
 * Loads a specific character from Firestore.
 * Applies feature rules to the loaded data before returning.
 * @param characterId - The ID of the character to load.
 * @returns The processed character data with derived values, or null if not found.
 */
export async function loadCharacter(characterId: string): Promise<Character | null> {
   if (!characterId) {
       const errorMsg = "Attempted to load character with empty ID.";
       console.warn("loadCharacter:", errorMsg);
       return null;
   }
  const characterDoc = doc(db, 'characters', characterId);
  try {
    const docSnap = await getDoc(characterDoc);
    if (docSnap.exists()) {
        const data = docSnap.data();
        const baseCharacter: Character = {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
            stats: data.stats || {},
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: 0, remaining: 0, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [] },
            features: Array.isArray(data.features) ? data.features : [],
        } as Character;

        // Apply feature rules to the loaded base character data
        const derivedCharacter = await applyFeatureRules(baseCharacter);
        return derivedCharacter;

    } else {
      console.log(`No character document found for ID: ${characterId}`);
      return null;
    }
  } catch (e) {
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in loadCharacter for ID ${characterId}: Firestore operation failed or feature application failed.`, error);
      await logError(error, {
          function: 'loadCharacter',
          characterId: characterId,
      });
    throw new Error('Failed to load character.');
  }
}

/**
 * Loads all characters (or potentially characters for a specific player if auth is added).
 * Applies feature rules to each loaded character.
 * @returns An array of processed character data.
 */
export async function loadAllCharacters(): Promise<Character[]> {
  // TODO: Add filtering by player ID if authentication is implemented
  const q = query(charactersCollection); // Simple query for all characters for now
  try {
    const querySnapshot = await getDocs(q);
    const characterPromises: Promise<Character | null>[] = [];

    querySnapshot.forEach((docSnap) => {
       const data = docSnap.data();
        const baseCharacter: Character = {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
            stats: data.stats || {},
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: 0, remaining: 0, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [] },
            features: Array.isArray(data.features) ? data.features : [],
        } as Character;
        // Apply rules to each character - can be parallelized
        characterPromises.push(applyFeatureRules(baseCharacter).catch(err => {
            logError(err, { function: 'loadAllCharacters.applyFeatureRules', characterId: baseCharacter.id });
            return null; // Return null on error for a specific character
        }));
    });

    const results = await Promise.all(characterPromises);
    // Filter out any characters that failed processing
    return results.filter((char): char is Character => char !== null);

  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error in loadAllCharacters: Firestore operation failed.', error);
    await logError(error, { function: 'loadAllCharacters' });
    throw new Error('Failed to load characters.');
  }
}

/**
 * Deletes a character from Firestore.
 * @param characterId - The ID of the character to delete.
 */
export async function deleteCharacter(characterId: string): Promise<void> {
   if (!characterId) {
       const errorMsg = "Attempted to delete character with missing ID.";
       console.error("deleteCharacter:", errorMsg);
       await logError(new Error(errorMsg), { function: 'deleteCharacter' });
       throw new Error("Character ID is required for deletion.");
   }
  const characterDoc = doc(db, 'characters', characterId);
  try {
    await deleteDoc(characterDoc);
    console.log('Character deleted with ID: ', characterId);
  } catch (e) {
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in deleteCharacter for ID ${characterId}: Firestore operation failed.`, error);
     await logError(error, {
         function: 'deleteCharacter',
         characterId: characterId,
     });
    throw new Error('Failed to delete character.');
  }
}

// Removed old applyFeatureEffects function as it's replaced by applyFeatureRules in feature-service.ts
