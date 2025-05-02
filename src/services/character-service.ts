
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
import { logError } from './logging-service'; // Import logging service

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
    // Before saving, apply feature effects to ensure derived stats are correct *initially*
    // Note: applyFeatureEffects is primarily for display; saving base stats is standard.
    // We might *not* want to save the derived stats, but calculate them on load/display.
    // For now, let's save the base data as provided by the creation wizard.

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
      // Similar to saveCharacter, we update based on the provided partial data.
      // Derived stats are usually calculated on the client/display layer.
      // If characterData includes features, ensure they are stored correctly.
      // If characterData includes stats, HP, etc., ensure they are the base values.
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
 * @param characterId - The ID of the character to load.
 * @returns The character data, or null if not found.
 */
export async function loadCharacter(characterId: string): Promise<Character | null> {
   if (!characterId) {
       const errorMsg = "Attempted to load character with empty ID.";
       console.warn("loadCharacter:", errorMsg);
       // Optionally log this warning if needed: await logMessage('warn', errorMsg, { function: 'loadCharacter' });
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
            // Safely convert timestamps
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
            // Ensure nested objects are correctly typed (Firestore might return plain objects)
            stats: data.stats || {},
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: 0, remaining: 0, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [] },
            features: Array.isArray(data.features) ? data.features : [],
        } as Character; // Use 'as' carefully, ensure data structure matches
      return character;
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
        // Convert Firestore Timestamps to Dates and ensure structure
        characters.push({
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
        } as Character);
    });
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


// --- Feature Effect Application Logic ---

/**
 * Applies the effects of a character's features (from race, class, etc.)
 * to calculate derived stats like final ability scores, AC, proficiencies.
 * This function takes the BASE character data and returns a character object
 * with calculated values based on features.
 * NOTE: This is intended for DISPLAY logic, not necessarily for saving derived data back.
 *
 * @param baseCharacter - The character object with base stats and features.
 * @returns A Character object with calculated, derived values.
 */
export async function applyFeatureEffects(baseCharacter: Character): Promise<Character> {
    const derivedCharacter = JSON.parse(JSON.stringify(baseCharacter)) as Character; // Deep copy

    // Initialize derived stats if needed (should ideally be done on load)
    derivedCharacter.stats = derivedCharacter.stats || {};
    derivedCharacter.proficiencies = derivedCharacter.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [] };
    derivedCharacter.skills = derivedCharacter.skills || {};

    const finalStats = { ...baseCharacter.stats };
    const finalProficiencies = {
        armor: [...baseCharacter.proficiencies.armor],
        weapons: [...baseCharacter.proficiencies.weapons],
        tools: [...baseCharacter.proficiencies.tools],
        savingThrows: [...baseCharacter.proficiencies.savingThrows],
    };
    const finalSkills = { ...baseCharacter.skills };
    let finalAC = 10; // Base AC before armor/features
    // Add other derived properties as needed (e.g., speed, resistances, advantages)

    (baseCharacter.features || []).forEach(feature => {
        if (!feature.metadata) return;

        const metadata = feature.metadata as FeatureEffectMetadata; // Type assertion

        // Apply effects based on metadata type
        switch (metadata.effectType) {
            case 'statBonus':
                Object.entries(metadata.stats).forEach(([stat, bonus]) => {
                    if (finalStats[stat as keyof typeof finalStats]) {
                        finalStats[stat as keyof typeof finalStats] += bonus;
                    }
                });
                break;
            case 'proficiencyGrant':
                switch (metadata.type) {
                    case 'armor':
                        finalProficiencies.armor.push(...metadata.proficiencies);
                        break;
                    case 'weapon':
                        finalProficiencies.weapons.push(...metadata.proficiencies);
                        break;
                    case 'tool':
                        finalProficiencies.tools.push(...metadata.proficiencies);
                        break;
                    case 'savingThrow':
                        finalProficiencies.savingThrows.push(...metadata.proficiencies);
                        break;
                    case 'skill':
                        metadata.proficiencies.forEach(skill => {
                            finalSkills[skill.toLowerCase()] = true;
                        });
                        break;
                }
                break;
            case 'acBonus':
                // AC calculation is complex, involving base armor, dex, shield, and features.
                // This simplified version just adds a direct bonus. A full calculation
                // should happen *after* applying all features, considering armor worn.
                // We'll handle the full AC calculation separately.
                console.log(`AC bonus feature found: ${feature.name} +${metadata.value}`);
                // For now, just note it; final AC calculation happens later.
                break;
            case 'advantage':
                // Applying advantage requires modifying specific roll checks.
                // This metadata serves as information for the UI/combat tracker.
                 console.log(`Advantage feature found: ${feature.name} on ${metadata.target} (${metadata.condition})`);
                break;
             case 'resistance':
                // Applying resistance requires modifying damage calculation.
                // This metadata serves as information for the UI/combat tracker.
                 console.log(`Resistance feature found: ${feature.name} to ${metadata.damageType}`);
                break;
            // Add cases for other metadata types (SpeedBonus, etc.)
            default:
                console.warn(`Unknown feature metadata effectType: ${(metadata as any).effectType} for feature ${feature.name}`);
        }
    });

    // --- Final Calculations (Post-Feature Application) ---

    // Ensure unique proficiencies
    derivedCharacter.proficiencies.armor = [...new Set(finalProficiencies.armor)];
    derivedCharacter.proficiencies.weapons = [...new Set(finalProficiencies.weapons)];
    derivedCharacter.proficiencies.tools = [...new Set(finalProficiencies.tools)];
    derivedCharacter.proficiencies.savingThrows = [...new Set(finalProficiencies.savingThrows)];
    derivedCharacter.skills = finalSkills; // Already updated skills

    // Apply final stats (affected by features)
    derivedCharacter.stats = finalStats;

    // Calculate Final AC based on equipment and features
    // This logic needs to be comprehensive, similar to CharacterSheet's calculation
    let calculatedAC = 10; // Start with unarmored base
    const dexMod = Math.floor((derivedCharacter.stats.dexterity - 10) / 2);
    let armorDexMod = dexMod;
    let maxDex: number | null = null;
    let hasShield = false;
    let armorEquipped = false;
    let unarmoredDefenseValue: number | null = null;

    // Check for Unarmored Defense features first
     derivedCharacter.features.forEach(f => {
         if (f.name === 'Unarmored Defense (Barbarian)' && !armorEquipped && !hasShield) { // Example check
             unarmoredDefenseValue = 10 + dexMod + Math.floor((derivedCharacter.stats.constitution - 10) / 2);
         }
         if (f.name === 'Unarmored Defense (Monk)' && !armorEquipped && !hasShield) { // Example check
             unarmoredDefenseValue = 10 + dexMod + Math.floor((derivedCharacter.stats.wisdom - 10) / 2);
         }
     });


    derivedCharacter.equipment
        .filter(item => item.isEquipped && item.type === 'Armor')
        .forEach(item => {
            if (item.armorCategory === 'Shield') {
                hasShield = true;
            } else if (!armorEquipped && item.baseAC !== undefined) { // Apply only the first equipped body armor
                calculatedAC = item.baseAC;
                if (item.addDexModifier === false) armorDexMod = 0;
                maxDex = item.maxDexBonus ?? null;
                armorEquipped = true;
            }
        });

    if (unarmoredDefenseValue !== null && !armorEquipped && !hasShield) {
         calculatedAC = unarmoredDefenseValue;
         armorDexMod = 0; // Dex mod is already included in the formula
    } else if (!armorEquipped) {
        calculatedAC = 10; // Base unarmored AC if no armor/unarmored defense
        armorDexMod = dexMod; // Use full dex mod
    }

    if (maxDex !== null) armorDexMod = Math.min(armorDexMod, maxDex);

    calculatedAC += armorDexMod;
    if (hasShield) calculatedAC += 2; // Standard shield bonus

    // Apply AC bonus features (after base calculation)
    derivedCharacter.features.forEach(feature => {
        if (feature.metadata?.effectType === 'acBonus') {
             // TODO: Add condition checking if needed
             calculatedAC += feature.metadata.value;
        }
    });


    // Assign the fully calculated AC (this isn't usually stored, but useful here)
    // For display, you'd likely just calculate this value without saving it back.
    // derivedCharacter.calculatedAC = calculatedAC; // Add a temporary field if needed

    // HP calculation (might depend on CON stat derived above)
    // Recalculate max HP based on final CON modifier if needed
    // derivedCharacter.hitPoints.max = calculateMaxHp(...);

    // TODO: Calculate derived Speed, Resistances, Advantages etc. based on features

    return derivedCharacter;
}
