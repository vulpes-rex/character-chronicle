
import type { CharacterClass as CharacterClassType, CharacterRace, Feature, CharacterLevel, EquipmentItem, HitPoints, BackgroundInfo, SourcePack } from '@/lib/types';
import { logError, logMessage } from './logging-service'; // Import logging service
import { getMultipleFeatureDefinitions } from './feature-service'; // Import feature service

// Re-export types from lib/types to ensure consistency
export type { CharacterClass, CharacterRace, Feature, CharacterLevel, EquipmentItem, HitPoints, BackgroundInfo };


// Placeholder for base SRD data if not provided by source packs
const BASE_BACKGROUNDS: Record<string, BackgroundInfo> = {
    "Acolyte": {
        name: "Acolyte",
        description: "You have spent your life in the service of a temple...",
        skillProficiencies: ["Insight", "Religion"],
        languages: { choose: 2 },
        feature: { name: "Shelter of the Faithful", description: "..." },
        equipment: ["Holy symbol", "Prayer book", "5 sticks incense", "Vestments", "Common clothes", "15 gp"],
    },
    "Urchin": {
        name: "Urchin",
        description: "You grew up on the streets alone...",
        skillProficiencies: ["Sleight of Hand", "Stealth"],
        toolProficiencies: ["Disguise kit", "Thieves' tools"],
        feature: { name: "City Secrets", description: "..." },
        equipment: ["Small knife", "Map of city", "Pet mouse", "Token", "Common clothes", "10 gp"],
    },
     "Soldier": {
         name: "Soldier",
         description: "War has been your life...",
         skillProficiencies: ["Athletics", "Intimidation"],
         toolProficiencies: ["One type of gaming set", "Vehicles (land)"],
         feature: { name: "Military Rank", description: "..." },
         equipment: ["Insignia of rank", "Trophy", "Gaming set", "Common clothes", "10 gp"],
     }
    // Add more base backgrounds
};

const BASE_CLASSES: CharacterClassType[] = [
            // Add base SRD class definitions here if needed as fallback
             {
                name: 'Fighter',
                description: 'A master of martial combat, skilled with a variety of weapons and armor.',
                hitDie: 'd10',
                proficiencies: {
                    armor: ['Light', 'Medium', 'Heavy', 'Shields'],
                    weapons: ['Simple', 'Martial'],
                    savingThrows: ['Strength', 'Constitution'],
                    skills: { choose: 2, options: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
                },
                 featuresByLevel: { // Example feature mapping
                    1: ['FightingStyleArchery', 'SecondWind'], // Feature keys
                    2: ['ActionSurge'],
                    // ... add more levels
                 }
            },
             {
                name: 'Wizard',
                description: 'A scholarly magic-user capable of manipulating the structures of reality.',
                hitDie: 'd6',
                proficiencies: {
                    armor: [],
                    weapons: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
                    savingThrows: ['Intelligence', 'Wisdom'],
                    skills: { choose: 2, options: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
                    tools: [],
                },
                  featuresByLevel: {
                    1: ['Spellcasting', 'ArcaneRecovery'],
                    2: ['ArcaneTradition'],
                    // ...
                 }
            },
             {
                name: 'Rogue',
                description: 'Master of stealth and subtlety.',
                hitDie: 'd8',
                proficiencies: {
                    armor: ['Light'],
                    weapons: ['Simple', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
                    tools: ["Thieves' Tools"],
                    savingThrows: ['Dexterity', 'Intelligence'],
                    skills: { choose: 4, options: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
                },
                 featuresByLevel: {
                    1: ['Expertise', 'SneakAttack', 'ThievesCant'],
                    2: ['CunningAction'],
                     // ...
                 }
            },
];

const BASE_RACES: CharacterRace[] = [
    {
        name: 'Human',
        description: 'Humans are the most common people in the worlds of D\&D, but they live nearly everywhere.',
        traits: ['HumanASI', 'ExtraLanguage'], // Feature keys
    },
    {
        name: 'Elf',
        description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
        traits: ['Darkvision', 'FeyAncestry', 'Trance'],
    },
    {
        name: 'Dwarf',
        description: 'Resilient and sturdy.',
        traits: ['Darkvision', 'DwarvenResilience', 'Stonecunning'],
    },
     {
        name: 'Halfling',
        description: 'Small and lucky.',
        traits: ['Lucky', 'Brave', 'HalflingNimbleness'],
     },
];

const BASE_ITEMS: EquipmentItem[] = [
    // Add base SRD item definitions here
    { name: 'Backpack', description: 'Holds adventuring gear', weight: 5, cost: '2 gp', type: 'Adventuring Gear' },
    { name: 'Bedroll', description: 'For sleeping', weight: 7, cost: '1 gp', type: 'Adventuring Gear' },
    { name: 'Rope (50 feet)', description: 'Hempen rope', weight: 10, cost: '1 gp', type: 'Adventuring Gear' },
    { name: 'Torch', description: 'Provides light', weight: 1, cost: '1 cp', type: 'Adventuring Gear' },
    { name: 'Rations (1 day)', description: 'Food for one day', weight: 2, cost: '5 sp', type: 'Adventuring Gear' },
    { name: 'Waterskin', description: 'Holds water (4 pints)', weight: 5, cost: '2 sp', type: 'Adventuring Gear' },
    { name: 'Longsword', description: 'Versatile martial weapon', weight: 3, cost: '15 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile (1d10)'] },
    { name: 'Dagger', description: 'Simple melee weapon', weight: 1, cost: '2 gp', type: 'Weapon', weaponCategory: 'Simple Melee', damageDice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Light', 'Thrown (range 20/60)'] },
    { name: 'Shortsword', description: 'Simple melee weapon', weight: 2, cost: '10 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d6', damageType: 'Piercing', properties: ['Finesse', 'Light'] },
    { name: 'Rapier', description: 'Martial melee weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Piercing', properties: ['Finesse'] },
    { name: 'Shortbow', description: 'Simple ranged weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d6', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Two-Handed'] },
    { name: 'Light Crossbow', description: 'Simple ranged weapon', weight: 5, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d8', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Loading', 'Two-Handed'] },
    { name: 'Leather Armor', description: 'Light armor', weight: 10, cost: '10 gp', type: 'Armor', armorCategory: 'Light', baseAC: 11, addDexModifier: true, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false },
    { name: 'Scale Mail', description: 'Medium armor', weight: 45, cost: '50 gp', type: 'Armor', armorCategory: 'Medium', baseAC: 14, addDexModifier: true, maxDexBonus: 2, strengthRequirement: null, stealthDisadvantage: true },
    { name: 'Chain Mail', description: 'Heavy armor', weight: 55, cost: '75 gp', type: 'Armor', armorCategory: 'Heavy', baseAC: 16, addDexModifier: false, maxDexBonus: null, strengthRequirement: 13, stealthDisadvantage: true },
    { name: 'Shield', description: 'Increases AC by 2', weight: 6, cost: '10 gp', type: 'Armor', armorCategory: 'Shield', baseAC: 2, addDexModifier: false, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false },
    { name: 'Healing Potion', description: 'Regain 2d4+2 hit points', weight: 0.5, cost: '50 gp', type: 'Potion' },
    { name: 'Thieves\' Tools', description: 'Tools for disarming traps and opening locks', weight: 1, cost: '25 gp', type: 'Tool' },
];


/**
 * Fetches available character classes, prioritizing source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of character classes.
 */
export async function getCharacterClasses(combinedContent?: SourcePack['content']): Promise<CharacterClassType[]> {
    logMessage('debug', 'getCharacterClasses: Fetching character classes.');
    let classes: CharacterClassType[] = [];

    // 1. Get classes from combined source pack content
    if (combinedContent?.classes) {
        classes = Object.values(combinedContent.classes);
        logMessage('debug', `getCharacterClasses: Found ${classes.length} classes in source packs.`);
    }

    // 2. TODO: Optionally merge/override with base SRD classes if needed.
    // For now, we assume source packs contain complete definitions if they exist.
    // If no classes were found in packs, load base SRD data.
    if (classes.length === 0) {
        logMessage('debug', 'getCharacterClasses: No classes in source packs, using base SRD placeholders.');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
        classes = BASE_CLASSES;
    }

    return classes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches available character races, prioritizing source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of character races.
 */
export async function getCharacterRaces(combinedContent?: SourcePack['content']): Promise<CharacterRace[]> {
    logMessage('debug', 'getCharacterRaces: Fetching character races.');
    let races: CharacterRace[] = [];

     // 1. Get races from combined source pack content
    if (combinedContent?.races) {
        races = Object.values(combinedContent.races);
        logMessage('debug', `getCharacterRaces: Found ${races.length} races in source packs.`);
    }

    // 2. Fallback to base SRD data if none found in packs.
    if (races.length === 0) {
        logMessage('debug', 'getCharacterRaces: No races in source packs, using base SRD placeholders.');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
        races = BASE_RACES;
    }

    return races.sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Fetches level up options for a specific character class and level.
 * This function now primarily focuses on identifying features gained AT the target level.
 * It relies on the class definition (potentially from source packs) having a 'featuresByLevel' map.
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
    const classData = combinedContent?.classes?.[className];
    let featureKeysAtLevel: string[] = [];

    if (classData?.featuresByLevel?.[targetLevel]) {
         // Use data from source pack if available
         featureKeysAtLevel = classData.featuresByLevel[targetLevel];
         logMessage('debug', `Found features for ${className} level ${targetLevel} in source pack: ${featureKeysAtLevel.join(', ')}`);
    } else {
        // Fallback to base SRD feature keys for this level (Example)
        logMessage('debug', `No level ${targetLevel} features for ${className} in source pack, using base definitions.`);
        const baseClassData = BASE_CLASSES.find(c => c.name === className);
         if (baseClassData?.featuresByLevel?.[targetLevel]) {
             featureKeysAtLevel = baseClassData.featuresByLevel[targetLevel];
         }
    }

    // 3. Fetch full definitions for the features gained at this level
    if (featureKeysAtLevel.length > 0) {
        try {
            featuresAtLevel = await getMultipleFeatureDefinitions(featureKeysAtLevel, combinedContent);
        } catch (error) {
             const e = error instanceof Error ? error : new Error(String(error));
             logError(e, {
                function: 'getLevelUpOptions',
                className: className,
                targetLevel: targetLevel,
                featureKeys: featureKeysAtLevel,
             });
             // Depending on requirements, might throw or return empty features
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
 * Fetches detailed descriptions for a list of race trait names, using source packs.
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
    // Use getMultipleFeatureDefinitions which already handles combinedContent fallback
    return getMultipleFeatureDefinitions(traitNames, combinedContent);
}


/**
 * Fetches all cumulative class features up to a certain level, using source packs.
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
    const classData = combinedContent?.classes?.[className] ?? BASE_CLASSES.find(c => c.name === className);
    let allFeatureKeys: string[] = [];

    if (classData?.featuresByLevel) {
        // Preferred: Use featuresByLevel from source pack or base data
        for (let level = 1; level <= maxLevel; level++) {
            if (classData.featuresByLevel[level]) {
                allFeatureKeys.push(...classData.featuresByLevel[level]);
            }
        }
    } else {
        logMessage('warn', `Class "${className}" lacks featuresByLevel definition.`);
    }

    // Fetch full definitions for all unique collected keys
    const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
    try {
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
 * Fetches a list of available equipment items, prioritizing source pack content.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of EquipmentItem objects.
 */
export async function getAvailableEquipmentItems(combinedContent?: SourcePack['content']): Promise<EquipmentItem[]> {
    logMessage('debug', 'getAvailableEquipmentItems: Fetching equipment items.');
    let items: EquipmentItem[] = [];

     // 1. Get items from combined source pack content
    if (combinedContent?.items) {
        items = Object.entries(combinedContent.items).map(([name, data]) => ({ name, ...data }));
        logMessage('debug', `getAvailableEquipmentItems: Found ${items.length} items in source packs.`);
    }

    // 2. Fallback to base SRD data if none found in packs.
    if (items.length === 0) {
        logMessage('debug', 'getAvailableEquipmentItems: No items in source packs, using base SRD placeholders.');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
        items = BASE_ITEMS;
    }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches a list of available background names, prioritizing source packs.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise that resolves to an array of background names.
 */
export async function getAvailableBackgrounds(combinedContent?: SourcePack['content']): Promise<string[]> {
    logMessage('debug', 'getAvailableBackgrounds: Fetching available background names.');
    let backgroundNames: string[] = [];

    // 1. Get from source packs
    if (combinedContent?.backgrounds) {
        backgroundNames = Object.keys(combinedContent.backgrounds);
        logMessage('debug', `getAvailableBackgrounds: Found ${backgroundNames.length} backgrounds in source packs.`);
    }

    // 2. Add base SRD names if not already present
    const baseNames = Object.keys(BASE_BACKGROUNDS);
    backgroundNames = [...new Set([...backgroundNames, ...baseNames])]; // Combine and ensure uniqueness

    if (backgroundNames.length === 0) {
        logMessage('warn', 'getAvailableBackgrounds: No backgrounds found in source packs or base data.');
    }

    return backgroundNames.sort();
}


/**
 * Fetches background details based on name, prioritizing source pack content.
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

    // 2. Fallback to base SRD data
    logMessage('debug', `Background "${backgroundName}" not found in source packs, checking base SRD.`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay

    return BASE_BACKGROUNDS[backgroundName] || null;
}
