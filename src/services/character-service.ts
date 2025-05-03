
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
import { applyFeatureRules } from './feature-service'; // Import applyFeatureRules

const charactersCollection = collection(db, 'characters');

/**
 * Saves a new character to Firestore.
 * Stores only BASE data (base stats, chosen proficiencies, etc.).
 * Derived values are calculated on load/display.
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
    logMessage('debug', 'Saving character data:', characterData); // Log the data being saved
    // Save the base data as provided by the creation wizard.
    const docRef = await addDoc(charactersCollection, {
      ...characterData,
      // Ensure only base stats are saved
      stats: characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      // Ensure featureChoices is saved
      featureChoices: characterData.featureChoices || {},
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
 * Only saves base data fields.
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

  // Ensure we only try to update fields that should be persisted (base stats, etc.)
  const dataToUpdate: Record<string, any> = { ...characterData };
  // Explicitly remove any derived fields if they accidentally got included
  // delete dataToUpdate.derivedStats; // Example if derivedStats existed
  // Base stats should only be updated if they are explicitly passed in characterData
  if (!characterData.stats) {
      delete dataToUpdate.stats;
  }

  // Ensure featureChoices is included if provided
  if ('featureChoices' in characterData) {
    dataToUpdate.featureChoices = characterData.featureChoices || {};
  }


  dataToUpdate.updatedAt = serverTimestamp();

  try {
    await updateDoc(characterDoc, dataToUpdate);
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
 * Loads a specific character from Firestore and applies feature rules.
 * @param characterId - The ID of the character to load.
 * @returns The Character object with derived values applied, or null if not found.
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
        // Convert Firestore Timestamps to JS Dates
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

        // Construct the base character object from Firestore data
        const baseCharacter: Character = {
            ...data,
            id: docSnap.id,
            createdAt: createdAt,
            updatedAt: updatedAt,
            // Ensure required fields have defaults if missing in Firestore
            stats: data.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: data.level || 0, remaining: data.level || 0, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            features: Array.isArray(data.features) ? data.features : [],
            featureChoices: data.featureChoices || {},
            playerName: data.playerName || 'Unknown Player',
            characterName: data.characterName || 'Unnamed Character',
            race: data.race || 'Unknown Race',
            class: data.class || 'Unknown Class',
            level: data.level || 1,
            background: data.background || 'Unknown Background',
            alignment: data.alignment || 'Neutral',
            backstory: data.backstory || '',
            appearance: data.appearance || '',
        } as Character; // Type assertion after filling defaults

        // Apply feature rules to calculate derived values
        const characterWithDerived = await applyFeatureRules(baseCharacter);
        return characterWithDerived;

    } else {
      console.log(`No character document found for ID: ${characterId}`);
      return null;
    }
  } catch (e) {
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in loadCharacter for ID ${characterId}: Firestore operation failed.`, error);
      await logError(error, {
          function: 'loadCharacter',
          characterId: characterId,
      });
    throw new Error('Failed to load character.');
  }
}

/**
 * Loads all characters (or potentially characters for a specific player if auth is added)
 * and applies feature rules to each.
 * @returns An array of Character objects with derived values applied.
 */
export async function loadAllCharacters(): Promise<Character[]> {
  // TODO: Add filtering by player ID if authentication is implemented
  const q = query(charactersCollection); // Simple query for all characters for now
  try {
    const querySnapshot = await getDocs(q);
    const characters: Character[] = [];

    // Use Promise.all to apply rules concurrently after fetching
    await Promise.all(querySnapshot.docs.map(async (docSnap) => {
       const data = docSnap.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

       // Construct base character
        const baseCharacter: Character = {
            ...data,
            id: docSnap.id,
            createdAt: createdAt,
            updatedAt: updatedAt,
            // Ensure required fields have defaults if missing in Firestore
            stats: data.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: data.level || 0, remaining: data.level || 0, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            features: Array.isArray(data.features) ? data.features : [],
            featureChoices: data.featureChoices || {},
             playerName: data.playerName || 'Unknown Player',
             characterName: data.characterName || 'Unnamed Character',
             race: data.race || 'Unknown Race',
             class: data.class || 'Unknown Class',
             level: data.level || 1,
             background: data.background || 'Unknown Background',
             alignment: data.alignment || 'Neutral',
             backstory: data.backstory || '',
             appearance: data.appearance || '',
        } as Character; // Type assertion after filling defaults

        // Apply rules and add to list
        const characterWithDerived = await applyFeatureRules(baseCharacter);
        characters.push(characterWithDerived);
    }));

    return characters;

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

// Removed erroneous JSX block from here
