
'use server';

import type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, SourcePack, Spell } from '@character-chronicle/shared/types'; // Use shared library path
// Removed direct NestJS service imports - interaction will happen via API calls or Server Actions calling the API
import { logMessage, logError } from '@/services/logging-service';

// TODO: Implement API client or replace these functions with direct API calls
// These functions are now placeholders and need to be implemented to call the new API app.

export async function getCharacterClasses(combinedContent?: SourcePack['content']): Promise<CharacterClass[]> {
  try {
    logMessage('debug', 'Fetching character classes via server action.');
    // Replace with API call
    // Example: const response = await fetch('/api/dnd/classes'); // Or pass content context if needed
    // const classes = await response.json();
    const classes: CharacterClass[] = []; // Placeholder
    logMessage('debug', `Fetched ${classes.length} character classes (placeholder).`);
    return classes;
  } catch (error) {
    logError(error, { message: 'Error fetching character classes.' });
    return [];
  }
}

export async function getCharacterRaces(combinedContent?: SourcePack['content']): Promise<CharacterRace[]> {
  try {
    logMessage('debug', 'Fetching character races via server action.');
     // Replace with API call
     // Example: const response = await fetch('/api/dnd/races');
     // const races = await response.json();
    const races: CharacterRace[] = []; // Placeholder
    logMessage('debug', `Fetched ${races.length} character races (placeholder).`);
    return races;
  } catch (error) {
    logError(error, { message: 'Error fetching character races.' });
    return [];
  }
}

export async function getLevelUpOptions(className: string, targetLevel: number, combinedContent?: SourcePack['content']): Promise<CharacterLevel> {
  try {
    logMessage('debug', `Fetching level up options for ${className} Lvl ${targetLevel}.`);
    // Replace with API call
    // Example: const response = await fetch(`/api/dnd/level-up?class=${className}&level=${targetLevel}`);
    // const levelOptions = await response.json();
    const levelOptions: CharacterLevel = { level: targetLevel, features: [], proficiencyBonus: undefined }; // Placeholder
    logMessage('debug', `Fetched level up options for ${className} Lvl ${targetLevel} (placeholder). Features found: ${levelOptions.features.length}`);
    return levelOptions;
  } catch (error) {
    logError(error, { message: `Error fetching level up options for ${className} Lvl ${targetLevel}.` });
    return { level: targetLevel, features: [], proficiencyBonus: undefined };
  }
}

export async function getAvailableEquipmentItems(combinedContent?: SourcePack['content']): Promise<EquipmentItem[]> {
  try {
    logMessage('debug', 'Fetching available equipment items via server action.');
    // Replace with API call
    // Example: const response = await fetch('/api/dnd/equipment');
    // const items = await response.json();
    const items: EquipmentItem[] = []; // Placeholder
    logMessage('debug', `Fetched ${items.length} equipment items (placeholder).`);
    return items;
  } catch (error) {
    logError(error, { message: 'Error fetching equipment items.' });
    return [];
  }
}

export async function getAvailableBackgrounds(combinedContent?: SourcePack['content']): Promise<string[]> {
  try {
    logMessage('debug', 'Fetching available background names via server action.');
     // Replace with API call
     // Example: const response = await fetch('/api/dnd/backgrounds/names');
     // const names = await response.json();
    const names: string[] = []; // Placeholder
    logMessage('debug', `Fetched ${names.length} background names (placeholder).`);
    return names;
  } catch (error) {
    logError(error, { message: 'Error fetching background names.' });
    return [];
  }
}

export async function getBackgroundDetails(backgroundName: string, combinedContent?: SourcePack['content']): Promise<BackgroundInfo | null> {
  try {
    logMessage('debug', `Fetching details for background: ${backgroundName}.`);
    // Replace with API call
    // Example: const response = await fetch(`/api/dnd/backgrounds/${encodeURIComponent(backgroundName)}`);
    // if (response.status === 404) return null;
    // const details = await response.json();
    const details: BackgroundInfo | null = null; // Placeholder
    logMessage('debug', `Background details ${details ? 'found' : 'not found'} for: ${backgroundName} (placeholder).`);
    return details;
  } catch (error) {
    logError(error, { message: `Error fetching background details for ${backgroundName}.` });
    return null;
  }
}

export async function getSpells(combinedContent?: SourcePack['content']): Promise<Spell[]> {
  try {
    logMessage('debug', 'Fetching spells via server action.');
     // Replace with API call
     // Example: const response = await fetch('/api/dnd/spells');
     // const spells = await response.json();
    const spells: Spell[] = []; // Placeholder
    logMessage('debug', `Fetched ${spells.length} spells (placeholder).`);
    return spells;
  } catch (error) {
    logError(error, { message: 'Error fetching spells.' });
    return [];
  }
}

// Re-export types for convenience if needed by client components importing from this service file
export type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, Spell };
