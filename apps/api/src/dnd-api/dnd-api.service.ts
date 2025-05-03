
import { Injectable } from '@nestjs/common';
import type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, SourcePack, Spell } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { FeaturesService } from '../features/features.service'; // Updated path
import { SRD_SOURCE_PACK } from '@character-chronicle/shared/data'; // Use shared library path

// Re-export types if needed by consumers of this service module
export type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, BackgroundInfo, Spell };

@Injectable()
export class DndApiService {
  constructor(
    private readonly logger: LoggingService,
    private readonly featuresService: FeaturesService, // Inject FeaturesService
  ) {}

  /** Fetches available character classes. */
  async getCharacterClasses(combinedContent?: SourcePack['content']): Promise<CharacterClass[]> {
    this.logger.debug('Fetching character classes.', 'DndApiService');
    let classesMap = { ...(SRD_SOURCE_PACK.content.classes || {}) };
    if (combinedContent?.classes) {
        classesMap = { ...classesMap, ...combinedContent.classes };
        this.logger.debug(`Merged/overrode with ${Object.keys(combinedContent.classes).length} classes from source packs.`, 'DndApiService');
    }
    const classes = Object.values(classesMap);
    return classes.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Fetches available character races. */
  async getCharacterRaces(combinedContent?: SourcePack['content']): Promise<CharacterRace[]> {
    this.logger.debug('Fetching character races.', 'DndApiService');
    let racesMap = { ...(SRD_SOURCE_PACK.content.races || {}) };
    if (combinedContent?.races) {
        racesMap = { ...racesMap, ...combinedContent.races };
        this.logger.debug(`Merged/overrode with ${Object.keys(combinedContent.races).length} races from source packs.`, 'DndApiService');
    }
    const races = Object.values(racesMap);
    return races.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Fetches level up options for a class and level. */
  async getLevelUpOptions(
    className: string,
    targetLevel: number,
    combinedContent?: SourcePack['content']
  ): Promise<CharacterLevel> {
    this.logger.debug(`Fetching level up options for ${className} level ${targetLevel}.`, 'DndApiService');
    let featuresAtLevel: Feature[] = [];
    let proficiencyBonus: number | undefined = undefined;

    if (targetLevel >= 1 && targetLevel <= 4) proficiencyBonus = 2;
    else if (targetLevel >= 5 && targetLevel <= 8) proficiencyBonus = 3;
    else if (targetLevel >= 9 && targetLevel <= 12) proficiencyBonus = 4;
    else if (targetLevel >= 13 && targetLevel <= 16) proficiencyBonus = 5;
    else if (targetLevel >= 17 && targetLevel <= 20) proficiencyBonus = 6;

    const classData = combinedContent?.classes?.[className] ?? SRD_SOURCE_PACK.content.classes?.[className];
    let featureKeysAtLevel: string[] = [];
    if (classData?.featuresByLevel?.[targetLevel]) {
         featureKeysAtLevel = classData.featuresByLevel[targetLevel];
         this.logger.debug(`Found features for ${className} level ${targetLevel}: ${featureKeysAtLevel.join(', ')}`, 'DndApiService');
    } else { this.logger.debug(`No level ${targetLevel} features definition found for ${className}.`, 'DndApiService'); }

    if (featureKeysAtLevel.length > 0) {
        try {
            // Use injected FeaturesService
            featuresAtLevel = await this.featuresService.getMultipleFeatureDefinitions(featureKeysAtLevel, combinedContent);
        } catch (error) {
             this.logger.error(`Error fetching feature definitions for ${className} Lvl ${targetLevel}`, error instanceof Error ? error.stack : undefined, 'DndApiService', { featureKeysAtLevel });
             featuresAtLevel = [];
        }
    }

    return { level: targetLevel, features: featuresAtLevel, proficiencyBonus };
  }

  /** Fetches a list of available equipment items. */
  async getAvailableEquipmentItems(combinedContent?: SourcePack['content']): Promise<EquipmentItem[]> {
    this.logger.debug('Fetching equipment items.', 'DndApiService');
    let itemsMap = { ...(SRD_SOURCE_PACK.content.items || {}) };
    if (combinedContent?.items) {
        itemsMap = { ...itemsMap, ...combinedContent.items };
        this.logger.debug(`Merged/overrode with ${Object.keys(combinedContent.items).length} items from source packs.`, 'DndApiService');
    }
    const items = Object.entries(itemsMap).map(([name, data]) => ({ name, ...data }));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Fetches a list of available background names. */
  async getAvailableBackgrounds(combinedContent?: SourcePack['content']): Promise<string[]> {
    this.logger.debug('Fetching available background names.', 'DndApiService');
    const srdNames = Object.keys(SRD_SOURCE_PACK.content.backgrounds || {});
    let combinedNames: string[] = [...srdNames];
    if (combinedContent?.backgrounds) {
        combinedNames = [...combinedNames, ...Object.keys(combinedContent.backgrounds)];
        this.logger.debug(`Added ${Object.keys(combinedContent.backgrounds).length} backgrounds from source packs.`, 'DndApiService');
    }
    const uniqueNames = [...new Set(combinedNames)];
    if (uniqueNames.length === 0) this.logger.warn('No backgrounds found.', 'DndApiService');
    return uniqueNames.sort();
  }

  /** Fetches background details based on name. */
  async getBackgroundDetails(
    backgroundName: string,
    combinedContent?: SourcePack['content']
  ): Promise<BackgroundInfo | null> {
    this.logger.debug(`Fetching details for background: ${backgroundName}`, 'DndApiService');
    if (combinedContent?.backgrounds?.[backgroundName]) {
         this.logger.debug(`Found background "${backgroundName}" in source packs.`, 'DndApiService');
        return combinedContent.backgrounds[backgroundName];
    }
    const srdBackground = SRD_SOURCE_PACK.content.backgrounds?.[backgroundName];
    if (srdBackground) {
        this.logger.debug(`Found background "${backgroundName}" in SRD.`, 'DndApiService');
        return srdBackground;
    }
    this.logger.warn(`Background "${backgroundName}" not found.`, 'DndApiService');
    return null;
  }

  /** Fetches available spells. */
  async getSpells(combinedContent?: SourcePack['content']): Promise<Spell[]> {
    this.logger.debug('Fetching spells.', 'DndApiService');
    let spellsMap = { ...(SRD_SOURCE_PACK.content.spells || {}) };
    if (combinedContent?.spells) {
        spellsMap = { ...spellsMap, ...combinedContent.spells };
        this.logger.debug(`Merged/overrode with ${Object.keys(combinedContent.spells).length} spells from source packs.`, 'DndApiService');
    }
    const spells = Object.entries(spellsMap).map(([name, data]) => ({ name, ...data }));
    return spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
}
