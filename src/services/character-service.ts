
'use server';

import type { Character } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container'; // Corrected import path
import { CharacterService as NestCharacterService } from '@/nestjs/character/character.service';
import { logMessage, logError } from '@/services/logging-service'; // Use server-side logging service

const getCharacterService = async (): Promise<NestCharacterService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestCharacterService);
};

// --- Server Actions ---

export async function saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> {
  try {
    logMessage('info', `Attempting to save character: ${characterData.characterName}`, { userId });
    const service = await getCharacterService();
    const characterId = await service.saveCharacter(characterData, userId);
    logMessage('info', `Character saved successfully with ID: ${characterId}`, { userId, characterId });
    return characterId;
  } catch (error) {
    logError(error, { message: `Error saving character ${characterData.characterName}`, userId });
    throw new Error(`Failed to save character: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateCharacter(characterId: string, characterUpdates: Partial<Omit<Character, 'id' | 'createdAt' | 'playerId'>>, userId: string): Promise<void> {
  try {
    logMessage('info', `Attempting to update character: ${characterId}`, { userId, updateKeys: Object.keys(characterUpdates) });
    const service = await getCharacterService();
    await service.updateCharacter(characterId, characterUpdates, userId);
    logMessage('info', `Character updated successfully: ${characterId}`, { userId });
  } catch (error) {
    logError(error, { message: `Error updating character ${characterId}`, userId });
    throw new Error(`Failed to update character: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function loadCharacter(characterId: string): Promise<Character | null> {
  try {
    logMessage('debug', `Attempting to load character: ${characterId}`);
    const service = await getCharacterService();
    const character = await service.loadCharacter(characterId); // applyRules defaults to true
    if (character) {
      logMessage('debug', `Character loaded successfully: ${characterId}`);
    } else {
      logMessage('debug', `Character not found: ${characterId}`);
    }
    return character;
  } catch (error) {
    logError(error, { message: `Error loading character ${characterId}` });
    // Don't throw to client, return null
    return null;
  }
}

export async function loadAllCharacters(playerId?: string): Promise<Character[]> {
  try {
    logMessage('debug', `Attempting to load all characters for player: ${playerId ?? 'N/A'}`);
    if (!playerId) {
        logMessage('warn', 'loadAllCharacters called without playerId.');
        return [];
    }
    const service = await getCharacterService();
    const characters = await service.loadAllCharacters(playerId);
    logMessage('debug', `Loaded ${characters.length} characters for player: ${playerId}`);
    return characters;
  } catch (error) {
    logError(error, { message: `Error loading all characters for player ${playerId ?? 'N/A'}` });
    return []; // Return empty array on error
  }
}

export async function deleteCharacter(characterId: string, userId: string): Promise<void> {
  try {
    logMessage('info', `Attempting to delete character: ${characterId}`, { userId });
    const service = await getCharacterService();
    await service.deleteCharacter(characterId, userId);
    logMessage('info', `Character deleted successfully: ${characterId}`, { userId });
  } catch (error) {
    logError(error, { message: `Error deleting character ${characterId}`, userId });
    throw new Error(`Failed to delete character: ${error instanceof Error ? error.message : String(error)}`);
  }
}

