'use server';

/**
 * @fileOverview Server Actions for character management.
 * These actions bridge the Next.js frontend with the NestJS backend services.
 */

import type { Character } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { CharacterService } from '@/nestjs/character/character.service';
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the CharacterService instance
const getCharacterService = async (): Promise<CharacterService> => {
  const container = await AppContainer.getInstance();
  return container.get(CharacterService);
};

// --- Character Management Actions ---

export async function saveCharacterAction(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<{ success: boolean; characterId?: string; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to save character: ${characterData.characterName}`, { userId });
    const characterService = await getCharacterService();
    const characterId = await characterService.saveCharacter(characterData, userId);
    logMessage('info', `[Action] Character saved successfully: ${characterId}`, { userId, characterId });
    return { success: true, characterId };
  } catch (error) {
    logError(error, { message: `[Action] Error saving character ${characterData.characterName}`, userId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save character.' };
  }
}

export async function updateCharacterAction(characterId: string, characterUpdates: Partial<Omit<Character, 'id' | 'createdAt' | 'playerId'>>, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to update character: ${characterId}`, { userId, updateKeys: Object.keys(characterUpdates) });
    const characterService = await getCharacterService();
    await characterService.updateCharacter(characterId, characterUpdates, userId);
    logMessage('info', `[Action] Character updated successfully: ${characterId}`, { userId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error updating character ${characterId}`, userId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update character.' };
  }
}

export async function loadCharacterAction(characterId: string): Promise<{ success: boolean; character?: Character | null; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load character: ${characterId}`);
    const characterService = await getCharacterService();
    // applyRules = true by default in Nest service, should return derived character
    const character = await characterService.loadCharacter(characterId);
    logMessage('debug', `[Action] Character ${characterId} ${character ? 'loaded' : 'not found'}.`);
    return { success: true, character };
  } catch (error) {
    logError(error, { message: `[Action] Error loading character ${characterId}` });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load character.' };
  }
}

export async function loadAllCharactersAction(playerId?: string): Promise<{ success: boolean; characters: Character[]; error?: string }> {
  try {
    logMessage('debug', `[Action] Attempting to load all characters for player: ${playerId ?? 'N/A'}`);
    if (!playerId) {
        logMessage('warn', '[Action] loadAllCharactersAction called without playerId.');
        return { success: true, characters: [] }; // Return success with empty array
    }
    const characterService = await getCharacterService();
    const characters = await characterService.loadAllCharacters(playerId);
    logMessage('debug', `[Action] Loaded ${characters.length} characters for player: ${playerId}`);
    return { success: true, characters };
  } catch (error) {
    logError(error, { message: `[Action] Error loading all characters for player ${playerId ?? 'N/A'}` });
    return { success: false, characters: [], error: error instanceof Error ? error.message : 'Failed to load characters.' };
  }
}

export async function deleteCharacterAction(characterId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    logMessage('info', `[Action] Attempting to delete character: ${characterId}`, { userId });
    const characterService = await getCharacterService();
    await characterService.deleteCharacter(characterId, userId);
    logMessage('info', `[Action] Character deleted successfully: ${characterId}`, { userId });
    return { success: true };
  } catch (error) {
    logError(error, { message: `[Action] Error deleting character ${characterId}`, userId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete character.' };
  }
}

// Action for taking a short rest
export async function takeShortRestAction(characterId: string, userId: string, hitDiceToSpend: number): Promise<{ success: boolean; character?: Character | null; error?: string }> {
    try {
        logMessage('info', `[Action] Character ${characterId} attempting short rest`, { userId, hitDiceToSpend });
        const characterService = await getCharacterService();
        const updatedCharacter = await characterService.takeShortRest(characterId, userId, hitDiceToSpend);
        logMessage('info', `[Action] Character ${characterId} completed short rest`, { userId });
        return { success: true, character: updatedCharacter };
    } catch (error) {
        logError(error, { message: `[Action] Error during short rest for character ${characterId}`, userId, hitDiceToSpend });
        return { success: false, error: error instanceof Error ? error.message : 'Failed to take short rest.' };
    }
}

// Action for taking a long rest
export async function takeLongRestAction(characterId: string, userId: string): Promise<{ success: boolean; character?: Character | null; error?: string }> {
    try {
        logMessage('info', `[Action] Character ${characterId} attempting long rest`, { userId });
        const characterService = await getCharacterService();
        const updatedCharacter = await characterService.takeLongRest(characterId, userId);
        logMessage('info', `[Action] Character ${characterId} completed long rest`, { userId });
        return { success: true, character: updatedCharacter };
    } catch (error) {
        logError(error, { message: `[Action] Error during long rest for character ${characterId}`, userId });
        return { success: false, error: error instanceof Error ? error.message : 'Failed to take long rest.' };
    }
}

// Action for using a feature
export async function useFeatureAction(characterId: string, userId: string, featureName: string): Promise<{ success: boolean; character?: Character | null; error?: string }> {
    try {
        logMessage('info', `[Action] Character ${characterId} attempting to use feature: ${featureName}`, { userId });
        const characterService = await getCharacterService();
        const updatedCharacter = await characterService.useFeature(characterId, userId, featureName);
        logMessage('info', `[Action] Character ${characterId} used feature: ${featureName}`, { userId });
        return { success: true, character: updatedCharacter };
    } catch (error) {
        logError(error, { message: `[Action] Error using feature "${featureName}" for character ${characterId}`, userId });
        return { success: false, error: error instanceof Error ? error.message : `Failed to use feature "${featureName}".` };
    }
}

// Action for casting a spell
export async function castSpellAction(characterId: string, userId: string, spellName: string, spellLevel: number): Promise<{ success: boolean; character?: Character | null; error?: string }> {
    try {
        logMessage('info', `[Action] Character ${characterId} attempting to cast spell: ${spellName} at level ${spellLevel}`, { userId });
        const characterService = await getCharacterService();
        const updatedCharacter = await characterService.castSpell(characterId, userId, spellName, spellLevel);
        logMessage('info', `[Action] Character ${characterId} cast spell: ${spellName}`, { userId, spellLevel });
        return { success: true, character: updatedCharacter };
    } catch (error) {
        logError(error, { message: `[Action] Error casting spell "${spellName}" for character ${characterId}`, userId, spellLevel });
        return { success: false, error: error instanceof Error ? error.message : `Failed to cast spell "${spellName}".` };
    }
}

    