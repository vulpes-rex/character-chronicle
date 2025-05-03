
'use server';

import type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, SourcePack, Spell } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { DndApiService as NestDndApiService } from '@/nestjs/dnd-api/dnd-api.service';
import { logMessage, logError } from '@/services/logging-service';

const getDndApiService = async (): Promise<NestDndApiService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestDndApiService);
};

export async function getCharacterClasses(combinedContent?: SourcePack['content']): Promise<CharacterClass[]> {
  try {
    logMessage('debug', 'Fetching character classes via server action.');
    const service = await getDndApiService();
    const classes = await service.getCharacterClasses(combinedContent);
    logMessage('debug', `Fetched ${classes.length} character classes.`);
    return classes;
  } catch (error) {
    logError(error, { message: 'Error fetching character classes.' });
    return []; // Return empty array on error
  }
}

export async function getCharacterRaces(combinedContent?: SourcePack['content']): Promise<CharacterRace[]> {
  try {
    logMessage('debug', 'Fetching character races via server action.');
    const service = await getDndApiService();
    const races = await service.getCharacterRaces(combinedContent);
    logMessage('debug', `Fetched ${races.length} character races.`);
    return races;
  } catch (error) {
    logError(error, { message: 'Error fetching character races.' });
    return [];
  }
}

// Note: getLevelUpOptions might need adjustments if Feature definitions require complex fetching
export async function getLevelUpOptions(className: string, targetLevel: number, combinedContent?: SourcePack['content']): Promise<CharacterLevel> {
  try {
    logMessage('debug', `Fetching level up options for ${className} Lvl ${targetLevel}.`);
    const service = await getDndApiService();
    const levelOptions = await service.getLevelUpOptions(className, targetLevel, combinedContent);
    logMessage('debug', `Fetched level up options for ${className} Lvl ${targetLevel}. Features found: ${levelOptions.features.length}`);
    return levelOptions;
  } catch (error) {
    logError(error, { message: `Error fetching level up options for ${className} Lvl ${targetLevel}.` });
    // Return a default/empty structure on error
    return { level: targetLevel, features: [], proficiencyBonus: undefined };
  }
}

export async function getAvailableEquipmentItems(combinedContent?: SourcePack['content']): Promise<EquipmentItem[]> {
  try {
    logMessage('debug', 'Fetching available equipment items via server action.');
    const service = await getDndApiService();
    const items = await service.getAvailableEquipmentItems(combinedContent);
    logMessage('debug', `Fetched ${items.length} equipment items.`);
    return items;
  } catch (error) {
    logError(error, { message: 'Error fetching equipment items.' });
    return [];
  }
}

export async function getAvailableBackgrounds(combinedContent?: SourcePack['content']): Promise<string[]> {
  try {
    logMessage('debug', 'Fetching available background names via server action.');
    const service = await getDndApiService();
    const names = await service.getAvailableBackgrounds(combinedContent);
    logMessage('debug', `Fetched ${names.length} background names.`);
    return names;
  } catch (error) {
    logError(error, { message: 'Error fetching background names.' });
    return [];
  }
}

export async function getBackgroundDetails(backgroundName: string, combinedContent?: SourcePack['content']): Promise<BackgroundInfo | null> {
  try {
    logMessage('debug', `Fetching details for background: ${backgroundName}.`);
    const service = await getDndApiService();
    const details = await service.getBackgroundDetails(backgroundName, combinedContent);
    logMessage('debug', `Background details ${details ? 'found' : 'not found'} for: ${backgroundName}.`);
    return details;
  } catch (error) {
    logError(error, { message: `Error fetching background details for ${backgroundName}.` });
    return null;
  }
}

export async function getSpells(combinedContent?: SourcePack['content']): Promise<Spell[]> {
  try {
    logMessage('debug', 'Fetching spells via server action.');
    const service = await getDndApiService();
    const spells = await service.getSpells(combinedContent);
    logMessage('debug', `Fetched ${spells.length} spells.`);
    return spells;
  } catch (error) {
    logError(error, { message: 'Error fetching spells.' });
    return [];
  }
}

// Re-export types for convenience if needed by client components importing from this service file
export type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, Spell };
