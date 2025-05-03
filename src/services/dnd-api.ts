
import type { CharacterClass as CharacterClassType, CharacterRace, Feature, CharacterLevel, EquipmentItem, HitPoints, BackgroundInfo, SourcePack, Spell } from '@/lib/types'; // Added Spell
import { logError, logMessage } from './logging-service'; // Import logging service
import { getMultipleFeatureDefinitions } from './feature-service'; // Import feature service
import { SRD_SOURCE_PACK } from '@/lib/srd-data'; // Import the SRD data definition

// Re-export types from lib/types to ensure consistency
export type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, HitPoints, BackgroundInfo, Spell };


/**
 * Fetches available character classes, combining SRD and source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of character classes.
 */
export async function getCharacterClasses(combinedContent?: SourcePack['content']): Promise<CharacterClassType[]> {
    logMessage('debug', 'getCharacterClasses: Fetching character classes.');

    // Start with SRD classes
    let classesMap = { ...(SRD_SOURCE_PACK.content.classes || {}) };

    // Merge/Override with combined content
    if (combinedContent?.classes) {
        classesMap = { ...classesMap, ...combinedContent.classes };
        logMessage('debug', `getCharacterClasses: Merged/overrode with ${Object.keys(combinedContent.classes).length} classes from source packs.`);
    }

    const classes = Object.values(classesMap);
    return classes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches available character races, combining SRD and source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of character races.
 */
export async function getCharacterRaces(combinedContent?: SourcePack['content']): Promise<CharacterRace[]> {
    logMessage('debug', 'getCharacterRaces: Fetching character races.');

    // Start with SRD races
    let racesMap = { ...(SRD_SOURCE_PACK.content.races || {}) };

    // Merge/Override with combined content
    if (combinedContent?.races) {
        racesMap = { ...racesMap, ...combinedContent.races };
         logMessage('debug', `getCharacterRaces: Merged/overrode with ${Object.keys(combinedContent.races).length} races from source packs.`);
    }

    const races = Object.values(racesMap);
    return races.sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Fetches level up options for a specific character class and level.
 * This function now primarily focuses on identifying features gained AT the target level.
 * It relies on the class definition (potentially from source packs or SRD) having a 'featuresByLevel' map.
 *
 * @param className The name of the character class.
 * @param targetLevel The level the character is advancing TO.
 * @param combinedContent Optional combined content for looking up class/feature definitions.
 * @returns A promise that resolves to the details (features, proficiency bonus) for the target level.
 */
export async function getLevelUpOptions(
    className: string,
    targetLevel: number,
    combinedContent?: SourcePack['content']
): Promise<CharacterLevel> {
    logMessage('debug', `getLevelUpOptions: Fetching options for ${className} level ${targetLevel}.`);

    let featuresAtLevel: Feature[] = [];
    let proficiencyBonus: number | undefined = undefined;

    // 1. Determine Proficiency Bonus (Standard 5e progression)
    if (targetLevel >= 1 && targetLevel <= 4) proficiencyBonus = 2;
    else if (targetLevel >= 5 && targetLevel <= 8) proficiencyBonus = 3;
    else if (targetLevel >= 9 && targetLevel <= 12) proficiencyBonus = 4;
    else if (targetLevel >= 13 && targetLevel <= 16) proficiencyBonus = 5;
    else if (targetLevel >= 17 && targetLevel <= 20) proficiencyBonus = 6;

    // 2. Find features gained AT this specific level
    // Prioritize combined content, fallback to SRD
    const classData = combinedContent?.classes?.[className] ?? SRD_SOURCE_PACK.content.classes?.[className];
    let featureKeysAtLevel: string[] = [];

    if (classData?.featuresByLevel?.[targetLevel]) {
         featureKeysAtLevel = classData.featuresByLevel[targetLevel];
         logMessage('debug', `Found features for ${className} level ${targetLevel} in combined/SRD: ${featureKeysAtLevel.join(', ')}`);
    } else {
        logMessage('debug', `No level ${targetLevel} features definition found for ${className}.`);
    }

    // 3. Fetch full definitions for the features gained at this level
    if (featureKeysAtLevel.length > 0) {
        try {
            // getMultipleFeatureDefinitions handles combinedContent/SRD fallback internally
            featuresAtLevel = await getMultipleFeatureDefinitions(featureKeysAtLevel, combinedContent);
        } catch (error) {
             const e = error instanceof Error ? error : new Error(String(error));
             logError(e, {
                function: 'getLevelUpOptions',
                className: className,
                targetLevel: targetLevel,
                featureKeys: featureKeysAtLevel,
             });
             featuresAtLevel = []; // Return empty on error
        }
    }

    return {
        level: targetLevel,
        features: featuresAtLevel,
        proficiencyBonus: proficiencyBonus,
    };
}


/**
 * Fetches detailed descriptions for a list of race trait names, using combined/SRD content.
 * @param traitNames - An array of trait keys/names to fetch details for.
 * @param combinedContent - Combined content from active source packs.
 * @returns A promise that resolves to an array of Feature objects representing the traits.
 */
export async function getRaceTraitsDetails(
    traitNames: string[],
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    logMessage('debug', `getRaceTraitsDetails: Fetching details for traits: ${traitNames.join(', ')}`);
    if (!traitNames || traitNames.length === 0) {
        return [];
    }
    // Use getMultipleFeatureDefinitions which already handles combinedContent/SRD fallback
    return getMultipleFeatureDefinitions(traitNames, combinedContent);
}


/**
 * Fetches all cumulative class features up to a certain level, combining SRD and source packs.
 * @param className The name of the character class.
 * @param maxLevel The maximum level to fetch features for.
 * @param combinedContent Optional combined content from active source packs.
 * @returns A promise that resolves to an array of all features gained up to maxLevel.
 */
export async function getCumulativeClassFeatures(
    className: string,
    maxLevel: number,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    if (!className || maxLevel < 1) {
        logMessage('warn', "getCumulativeClassFeatures: Invalid class name or level.");
        return [];
    }

    logMessage('debug', `getCumulativeClassFeatures: Fetching cumulative features for ${className} up to level ${maxLevel}.`);
    // Prioritize combined content, fallback to SRD
    const classData = combinedContent?.classes?.[className] ?? SRD_SOURCE_PACK.content.classes?.[className];
    let allFeatureKeys: string[] = [];

    if (!classData) {
         logMessage('error', `Class definition not found for "${className}" in combined content or SRD.`);
         return [];
    }

    if (classData.featuresByLevel) {
        for (let level = 1; level <= maxLevel; level++) {
            if (classData.featuresByLevel[level]) {
                allFeatureKeys.push(...classData.featuresByLevel[level]);
            }
        }
        logMessage('debug', `Accumulated feature keys for ${className} up to level ${maxLevel}: ${allFeatureKeys.join(', ')}`);
    } else {
        logMessage('warn', `Class "${className}" lacks featuresByLevel definition.`);
    }

    // Fetch full definitions for all unique collected keys
    const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
    if (uniqueFeatureKeys.length === 0) {
        logMessage('debug', `No unique feature keys found for ${className} up to level ${maxLevel}.`);
        return [];
    }
    try {
        // getMultipleFeatureDefinitions handles combined/SRD fallback for feature definitions
        return await getMultipleFeatureDefinitions(uniqueFeatureKeys, combinedContent);
    } catch (error) {
         const e = error instanceof Error ? error : new Error(String(error));
         logError(e, {
            function: 'getCumulativeClassFeatures',
            className: className,
            maxLevel: maxLevel,
            uniqueFeatureKeys: uniqueFeatureKeys,
         });
        throw new Error(`Failed to fetch cumulative features for ${className}.`);
    }
}


/**
 * Fetches a list of available equipment items, combining SRD and source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of EquipmentItem objects.
 */
export async function getAvailableEquipmentItems(combinedContent?: SourcePack['content']): Promise<EquipmentItem[]> {
    logMessage('debug', 'getAvailableEquipmentItems: Fetching equipment items.');

    // Start with SRD items
    let itemsMap = { ...(SRD_SOURCE_PACK.content.items || {}) };

    // Merge/Override with combined content
    if (combinedContent?.items) {
        itemsMap = { ...itemsMap, ...combinedContent.items };
        logMessage('debug', `getAvailableEquipmentItems: Merged/overrode with ${Object.keys(combinedContent.items).length} items from source packs.`);
    }

    const items = Object.entries(itemsMap).map(([name, data]) => ({ name, ...data }));
    return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches a list of available background names, combining SRD and source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of background names.
 */
export async function getAvailableBackgrounds(combinedContent?: SourcePack['content']): Promise<string[]> {
    logMessage('debug', 'getAvailableBackgrounds: Fetching available background names.');

    // Start with SRD names
    const srdNames = Object.keys(SRD_SOURCE_PACK.content.backgrounds || {});
    let combinedNames: string[] = [...srdNames];

    // Add names from combined content
    if (combinedContent?.backgrounds) {
        combinedNames = [...combinedNames, ...Object.keys(combinedContent.backgrounds)];
         logMessage('debug', `getAvailableBackgrounds: Added ${Object.keys(combinedContent.backgrounds).length} backgrounds from source packs.`);
    }

    const uniqueNames = [...new Set(combinedNames)]; // Ensure uniqueness

    if (uniqueNames.length === 0) {
        logMessage('warn', 'getAvailableBackgrounds: No backgrounds found in source packs or SRD.');
    }

    return uniqueNames.sort();
}


/**
 * Fetches background details based on name, prioritizing source pack content then SRD.
 * @param backgroundName The name of the background.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise resolving to background info or null.
 */
export async function getBackgroundDetails(
    backgroundName: string,
    combinedContent?: SourcePack['content']
): Promise<BackgroundInfo | null> {
    logMessage('debug', `getBackgroundDetails: Fetching details for background: ${backgroundName}`);

    // 1. Check combined content
    if (combinedContent?.backgrounds?.[backgroundName]) {
         logMessage('debug', `Found background "${backgroundName}" in source packs.`);
        return combinedContent.backgrounds[backgroundName];
    }

    // 2. Fallback to SRD data
    logMessage('debug', `Background "${backgroundName}" not found in source packs, checking SRD.`);
    const srdBackground = SRD_SOURCE_PACK.content.backgrounds?.[backgroundName];
    if (srdBackground) {
        logMessage('debug', `Found background "${backgroundName}" in SRD.`);
        return srdBackground;
    }

    logMessage('warn', `Background "${backgroundName}" not found in source packs or SRD.`);
    return null;
}


/**
 * Fetches available spells, combining SRD and source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of Spell objects.
 */
export async function getSpells(combinedContent?: SourcePack['content']): Promise<Spell[]> {
    logMessage('debug', 'getSpells: Fetching spells.');

    // Start with SRD spells
    let spellsMap = { ...(SRD_SOURCE_PACK.content.spells || {}) };

    // Merge/Override with combined content
    if (combinedContent?.spells) {
        spellsMap = { ...spellsMap, ...combinedContent.spells };
        logMessage('debug', `getSpells: Merged/overrode with ${Object.keys(combinedContent.spells).length} spells from source packs.`);
    }

    const spells = Object.entries(spellsMap).map(([name, data]) => ({ name, ...data }));
    return spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)); // Sort by level, then name
}
