
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
 * Stores only BASE data (base stats, chosen proficiencies, equipment, featureChoices, etc.).
 * Derived values (final stats, AC, modifiers) are calculated on load.
 *
 * @param characterData - The character data to save (without ID, createdAt, updatedAt). It should contain base values.
 * @param userId - The ID of the user creating the character.
 * @returns The ID of the newly created character.
 */
export async function saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> {
  if (!userId) {
       const errorMsg = "Attempted to save character without a user ID.";
       console.error("saveCharacter:", errorMsg);
       await logError(new Error(errorMsg), { function: 'saveCharacter', characterName: characterData?.characterName });
       throw new Error("User ID is required to save a character.");
   }
   if (!characterData || !characterData.characterName || !characterData.playerName) {
      const errorMsg = "Attempted to save character with missing core data.";
      console.error("saveCharacter:", errorMsg);
      await logError(new Error(errorMsg), { function: 'saveCharacter', characterName: characterData?.characterName });
      throw new Error("Missing required character data (e.g., character name, player name).");
  }
  try {
    logMessage('debug', 'Saving character data (base values):', characterData); // Log the data being saved

    // Prepare data for saving: ensure only base fields are included
    const dataToSave = {
        playerId: userId, // Add the owner's ID
        playerName: characterData.playerName,
        characterName: characterData.characterName,
        race: characterData.race,
        class: characterData.class,
        level: characterData.level,
        background: characterData.background,
        alignment: characterData.alignment,
        stats: characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        // Base skill PROFICIENCY selections (boolean map)
        skills: characterData.skills || {},
        // Base HP/HD values (current/remaining will be set)
        hitPoints: characterData.hitPoints || { max: 0, current: 0, temporary: 0 }, // Max will be calculated, but save initial state
        hitDice: characterData.hitDice || { total: characterData.level || 0, remaining: characterData.level || 0, dieType: null },
        equipment: characterData.equipment || [],
        // Base proficiencies (might be initially empty, derived later)
        proficiencies: characterData.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
        // Base features (definitions)
        features: characterData.features || [],
        featureChoices: characterData.featureChoices || {},
        // Spell selections
        spellsKnown: characterData.spellsKnown || [],
        spellsPrepared: characterData.spellsPrepared || [],
        // Descriptive fields
        backstory: characterData.backstory || '',
        appearance: characterData.appearance || '',
        campaignId: characterData.campaignId,
        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    // Perform the Firestore operation
    const docRef = await addDoc(charactersCollection, dataToSave);
    console.log('Character saved with ID: ', docRef.id);
    return docRef.id;

  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Error in saveCharacter for ${characterData.characterName}: Firestore operation failed.`, error);
    await logError(error, {
        function: 'saveCharacter',
        characterName: characterData.characterName,
        playerName: characterData.playerName,
        userId: userId, // Log the user ID
        race: characterData.race,
        class: characterData.class,
    });
    throw new Error('Failed to save character.');
  }
}

/**
 * Updates specific fields of an existing character in Firestore.
 * Only saves base data fields. Derived values should not be updated directly.
 * Includes permission check to ensure only the owner can update.
 *
 * @param characterId - The ID of the character to update.
 * @param characterUpdates - An object containing only the base character fields to update.
 * @param userId - The ID of the user attempting the update.
 */
export async function updateCharacter(characterId: string, characterUpdates: Partial<Omit<Character, 'id' | 'createdAt' | 'playerId'>>, userId: string): Promise<void> {
  if (!characterId || !userId) {
      const errorMsg = "Attempted to update character with missing ID or User ID.";
      console.error("updateCharacter:", errorMsg);
       await logError(new Error(errorMsg), { function: 'updateCharacter', characterId, userId });
      throw new Error("Character ID and User ID are required for update.");
  }
   if (!characterUpdates || Object.keys(characterUpdates).length === 0) {
      console.warn(`updateCharacter: Attempted to update character ${characterId} with empty data.`);
      return; // No changes to apply
  }
  const characterDoc = doc(db, 'characters', characterId);

  try {
    // Permission Check: Load base character data to check ownership
    const existingChar = await loadCharacter(characterId, false);
    if (!existingChar) {
       throw new Error(`Character ${characterId} not found.`);
    }
    if (existingChar.playerId !== userId) {
        const errorMsg = `Permission denied: User ${userId} cannot update character ${characterId} owned by ${existingChar.playerId}.`;
        console.warn(`updateCharacter: ${errorMsg}`);
        await logError(new Error('Permission denied'), { function: 'updateCharacter', characterId, userId, ownerId: existingChar.playerId });
       throw new Error('You do not have permission to update this character.');
    }

    // Prepare data for update, ensuring only allowed fields are included
    const dataToUpdate: Record<string, any> = { ...characterUpdates };

    // Explicitly disallow updating derived fields - remove them if present
    // Example: delete dataToUpdate.derivedStats;
    // Only allow updating base stats if explicitly provided
    if (!characterUpdates.stats) delete dataToUpdate.stats;
    if (!characterUpdates.proficiencies) delete dataToUpdate.proficiencies;
    // Ensure featureChoices is an object if provided
    if ('featureChoices' in dataToUpdate) {
        dataToUpdate.featureChoices = dataToUpdate.featureChoices || {};
    }
    // Ensure spells are arrays if provided
     if ('spellsKnown' in dataToUpdate && !Array.isArray(dataToUpdate.spellsKnown)) {
        dataToUpdate.spellsKnown = [];
     }
     if ('spellsPrepared' in dataToUpdate && !Array.isArray(dataToUpdate.spellsPrepared)) {
        dataToUpdate.spellsPrepared = [];
     }
     // Current/Temp HP and Remaining HD are exceptions - they represent current state
     // Ensure `hitPoints` and `hitDice` objects are not accidentally replaced entirely if only current/remaining change
      if (characterUpdates.hitPoints && (!('max' in characterUpdates.hitPoints))) {
          // Only updating current/temp, use existing max
          if (existingChar?.hitPoints?.max !== undefined) {
              dataToUpdate.hitPoints = {
                  max: existingChar.hitPoints.max,
                  current: characterUpdates.hitPoints.current ?? existingChar.hitPoints.current,
                  temporary: characterUpdates.hitPoints.temporary ?? existingChar.hitPoints.temporary,
              };
          } else {
              // Fallback or handle error if maxHP couldn't be retrieved
              delete dataToUpdate.hitPoints;
              console.warn(`updateCharacter: Could not verify max HP for ${characterId} when updating current/temp HP.`);
          }
      }
       if (characterUpdates.hitDice && (!('total' in characterUpdates.hitDice) || !('dieType' in characterUpdates.hitDice))) {
          // Only updating remaining, use existing total/dieType
          if (existingChar?.hitDice?.total !== undefined && existingChar?.hitDice?.dieType !== undefined) {
              dataToUpdate.hitDice = {
                  total: existingChar.hitDice.total,
                  remaining: characterUpdates.hitDice.remaining ?? existingChar.hitDice.remaining,
                  dieType: existingChar.hitDice.dieType,
              };
          } else {
              // Fallback or handle error if total/dieType couldn't be retrieved
               delete dataToUpdate.hitDice;
               console.warn(`updateCharacter: Could not verify total/dieType for ${characterId} when updating remaining HD.`);
          }
      }

      // Prevent changing playerId
      delete dataToUpdate.playerId;

    // Always add the update timestamp
    dataToUpdate.updatedAt = serverTimestamp();

    logMessage('debug', `Updating character ${characterId} with data:`, dataToUpdate);


    await updateDoc(characterDoc, dataToUpdate);
    console.log('Character updated with ID: ', characterId);
  } catch (e) {
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in updateCharacter for ID ${characterId}: Firestore operation failed.`, error);
     await logError(error, {
         function: 'updateCharacter',
         characterId: characterId,
         userId: userId,
         updateDataKeys: Object.keys(characterUpdates),
     });
    // Re-throw specific permission error or generic failure
    if (error.message.startsWith('Permission denied')) {
        throw error;
    }
    throw new Error('Failed to update character.');
  }
}

/**
 * Loads a specific character from Firestore.
 * Optionally applies feature rules to calculate derived values.
 *
 * @param characterId - The ID of the character to load.
 * @param applyRules - Whether to apply feature rules and calculate derived stats (default: true).
 * @returns The Character object (either base or with derived values), or null if not found.
 */
export async function loadCharacter(characterId: string, applyRules: boolean = true): Promise<Character | null> {
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
            playerId: data.playerId || null, // Include playerId
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
             spellcasting: data.spellcasting, // Keep raw spellcasting data if exists
             spellsKnown: data.spellsKnown || [],
             spellsPrepared: data.spellsPrepared || [],
        } as Character; // Type assertion after filling defaults

        if (!applyRules) {
             logMessage('debug', `Loaded base character ${characterId} without applying rules.`);
             return baseCharacter;
        }

        // Apply feature rules to calculate derived values
        const characterWithDerived = await applyFeatureRules(baseCharacter);
        logMessage('debug', `Loaded character ${characterId} and applied feature rules.`);
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
 * Loads all characters belonging to a specific player.
 * Applies feature rules to each character.
 * @param playerId - The ID of the player whose characters to load.
 * @returns An array of Character objects with derived values applied.
 */
export async function loadAllCharacters(playerId?: string): Promise<Character[]> {
  if (!playerId) {
    console.warn("loadAllCharacters called without a playerId.");
    return []; // Return empty if no player ID provided
  }
  const q = query(charactersCollection, where('playerId', '==', playerId));
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
            playerId: data.playerId, // Ensure playerId is included
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
              spellcasting: data.spellcasting,
              spellsKnown: data.spellsKnown || [],
              spellsPrepared: data.spellsPrepared || [],
        } as Character; // Type assertion after filling defaults

        // Apply rules and add to list
        const characterWithDerived = await applyFeatureRules(baseCharacter);
        characters.push(characterWithDerived);
    }));

    // Sort characters by update timestamp (descending)
    characters.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

    return characters;

  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error in loadAllCharacters: Firestore operation failed.', error);
    await logError(error, { function: 'loadAllCharacters', playerId: playerId });
    throw new Error('Failed to load characters.');
  }
}

/**
 * Deletes a character from Firestore.
 * Includes permission check to ensure only the owner can delete.
 * @param characterId - The ID of the character to delete.
 * @param userId - The ID of the user attempting the deletion.
 */
export async function deleteCharacter(characterId: string, userId: string): Promise<void> {
   if (!characterId || !userId) {
       const errorMsg = "Attempted to delete character with missing ID or User ID.";
       console.error("deleteCharacter:", errorMsg);
       await logError(new Error(errorMsg), { function: 'deleteCharacter', characterId, userId });
       throw new Error("Character ID and User ID are required for deletion.");
   }
  const characterDoc = doc(db, 'characters', characterId);

  try {
    // Permission Check: Load base character data to check ownership
    const existingChar = await loadCharacter(characterId, false);
    if (!existingChar) {
       throw new Error(`Character ${characterId} not found.`);
    }
    if (existingChar.playerId !== userId) {
        const errorMsg = `Permission denied: User ${userId} cannot delete character ${characterId} owned by ${existingChar.playerId}.`;
        console.warn(`deleteCharacter: ${errorMsg}`);
        await logError(new Error('Permission denied'), { function: 'deleteCharacter', characterId, userId, ownerId: existingChar.playerId });
       throw new Error('You do not have permission to delete this character.');
    }


    await deleteDoc(characterDoc);
    console.log('Character deleted with ID: ', characterId);
  } catch (e) {
     const error = e instanceof Error ? e : new Error(String(e));
     console.error(`Error in deleteCharacter for ID ${characterId}: Firestore operation failed.`, error);
     await logError(error, {
         function: 'deleteCharacter',
         characterId: characterId,
         userId: userId,
     });
     // Re-throw specific permission error or generic failure
     if (error.message.startsWith('Permission denied')) {
         throw error;
     }
    throw new Error('Failed to delete character.');
  }
}
