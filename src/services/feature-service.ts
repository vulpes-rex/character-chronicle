
'use server';

import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo } from '@/lib/types';
import { logError, logMessage } from './logging-service';

// --- Base/Placeholder Data (SRD or Core Rules) ---

// Example feature definitions including metadata
const BASE_FEATURE_DEFINITIONS: Record<string, Feature> = {
    // Race Features
    "HumanASI": {
        name: "Ability Score Increase",
        description: "Your ability scores each increase by 1.",
        source: "Human Race (Base)",
        metadata: {
            effectType: "statBonus",
            stats: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
        }
    },
    "ExtraLanguage": {
        name: "Extra Language",
        description: "You can speak, read, and write one extra language of your choice.",
        source: "Human Race (Base)",
        // Metadata could potentially indicate a choice needs to be made
    },
    "Darkvision": {
        name: "Darkvision",
        description: "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.",
        source: "Elf/Dwarf Race (Base)",
    },
    "FeyAncestry": {
        name: "Fey Ancestry",
        description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
        source: "Elf Race (Base)",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being charmed",
        }
    },
    "Trance": {
        name: "Trance",
        description: "Elves don’t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.",
        source: "Elf Race (Base)",
    },
    "DwarvenResilience": {
        name: "Dwarven Resilience",
        description: "You have advantage on saving throws against poison, and you have resistance against poison damage.",
        source: "Dwarf Race (Base)",
        metadata: {
            effectType: "resistance",
            damageType: "Poison",
        }
    },
    "Stonecunning": {
        name: "Stonecunning",
        description: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.",
        source: "Dwarf Race (Base)",
    },
    "Lucky": {
        name: "Lucky",
        description: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
        source: "Halfling Race (Base)",
        isActionable: true,
        maxUses: null,
        usesResetOn: null,
    },
    "Brave": {
        name: "Brave",
        description: "You have advantage on saving throws against being frightened.",
        source: "Halfling Race (Base)",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being frightened",
        }
    },
    "HalflingNimbleness": {
        name: "Halfling Nimbleness",
        description: "You can move through the space of any creature that is of a size larger than yours.",
        source: "Halfling Race (Base)",
    },

    // Class Features (Examples)
    "FightingStyleArchery": {
        name: "Fighting Style: Archery",
        description: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
        source: "Fighter Class (Base)",
    },
    "SecondWind": {
        name: "Second Wind",
        description: "On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter Class (Base)",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'short-rest',
    },
    "ActionSurge": {
        name: "Action Surge",
        description: "On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter Class (Base)",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'short-rest',
    },
     "Expertise": {
        name: "Expertise",
        description: "Choose two skill proficiencies, or one skill/tool proficiency. Double proficiency bonus for checks using chosen proficiencies.",
        source: "Rogue Class (Base)",
        // Requires player choice, metadata might indicate this
    },
    "SneakAttack": {
        name: "Sneak Attack",
        description: "Once per turn, you can deal extra damage (scales with level) to one creature you hit with an attack under certain conditions.",
        source: "Rogue Class (Base)",
    },
     "ThievesCant": {
        name: "Thieves' Cant",
        description: "A secret mix of dialect, jargon, and code allowing hidden messages.",
        source: "Rogue Class (Base)",
    },
     "CunningAction": {
        name: "Cunning Action",
        description: "Use a bonus action to take the Dash, Disengage, or Hide action.",
        source: "Rogue Class (Base)",
        isActionable: true,
    },
    "UnarmoredDefenseBarbarian": {
        name: 'Unarmored Defense (Barbarian)',
        description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
        source: 'Barbarian Class (Base)',
        metadata: {
            effectType: 'acBonus',
            value: 0,
            condition: 'not wearing armor',
        },
    },
    "UnarmoredDefenseMonk": {
        name: 'Unarmored Defense (Monk)',
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        source: 'Monk Class (Base)',
        metadata: {
            effectType: 'acBonus',
            value: 0,
            condition: 'not wearing armor and not wielding a shield',
        },
    },
    // Add other base features...
};

// --- Service Functions ---

/**
 * Fetches the full definition of a feature by its key/name.
 * Prioritizes finding the feature in the provided combinedContent from source packs,
 * then falls back to base definitions (like SRD).
 *
 * @param featureKey - The unique key/name of the feature.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns The Feature object or null if not found.
 */
export async function getFeatureDefinition(
    featureKey: string,
    combinedContent?: SourcePack['content']
): Promise<Feature | null> {
    try {
        // 1. Check combined content first
        if (combinedContent?.features && combinedContent.features[featureKey]) {
            // Assuming features are stored directly keyed by name in the combined content
             logMessage('debug', `Found feature "${featureKey}" in source pack content.`);
            return {
                 name: featureKey, // Ensure name is included
                 ...combinedContent.features[featureKey],
                 source: combinedContent.features[featureKey].source || 'Source Pack', // Use pack source or default
            };
        }

        // 2. Fallback to base definitions
        if (BASE_FEATURE_DEFINITIONS[featureKey]) {
             logMessage('debug', `Found feature "${featureKey}" in base definitions.`);
            return BASE_FEATURE_DEFINITIONS[featureKey];
        }

        // Feature not found
        logMessage('warn', `Feature definition not found for key: "${featureKey}".`);
        return null;
    } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error));
        logError(e, {
            function: 'getFeatureDefinition',
            featureKey: featureKey,
            hasCombinedContent: !!combinedContent,
        });
        // Depending on requirements, you might want to return null or re-throw
        return null;
    }
}


/**
 * Fetches definitions for multiple features, checking combined content first.
 * @param featureKeys - An array of feature keys/names.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise resolving to an array of found Feature objects.
 */
export async function getMultipleFeatureDefinitions(
    featureKeys: string[],
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    if (!featureKeys || featureKeys.length === 0) {
        return [];
    }

    const featurePromises = featureKeys.map(key => getFeatureDefinition(key, combinedContent));
    const results = await Promise.all(featurePromises);
    return results.filter((feature): feature is Feature => feature !== null);
}

/**
 * Retrieves features granted by a specific race name, considering source packs.
 * Assumes race definition in packs might contain feature names/keys.
 * @param raceName - The name of the race.
 * @param combinedContent - Combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the race.
 */
export async function getRaceFeatures(
    raceName: string,
    combinedContent: SourcePack['content']
): Promise<Feature[]> {
    if (!raceName || !combinedContent) {
        logMessage('warn', 'getRaceFeatures called without raceName or combinedContent.');
        return [];
    }

    let featureKeys: string[] = [];
    const raceData = combinedContent.races?.[raceName];

    if (raceData?.traits) {
        // Assuming 'traits' in the source pack race data holds the *keys/names* of the features
        featureKeys = raceData.traits;
         logMessage('debug', `Found race "${raceName}" in source packs, fetching features: ${featureKeys.join(', ')}`);
    } else {
        // Fallback to base race feature keys if not found in packs
         logMessage('debug', `Race "${raceName}" not found in source packs or has no traits defined, falling back to base definitions.`);
        switch (raceName) {
            case 'Human': featureKeys = ['HumanASI', 'ExtraLanguage']; break;
            case 'Elf': featureKeys = ['Darkvision', 'FeyAncestry', 'Trance']; break;
            case 'Dwarf': featureKeys = ['Darkvision', 'DwarvenResilience', 'Stonecunning']; break;
            case 'Halfling': featureKeys = ['Lucky', 'Brave', 'HalflingNimbleness']; break;
            // Add other base races
            default:
                 logMessage('warn', `No base features defined for race: "${raceName}"`);
                 featureKeys = [];
        }
    }

    return getMultipleFeatureDefinitions(featureKeys, combinedContent);
}


/**
 * Retrieves cumulative features granted by a specific class up to a given level, considering source packs.
 * Assumes class definitions in packs might contain features per level.
 * @param className - The name of the class.
 * @param level - The character's level in that class.
 * @param combinedContent - Combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the class/level.
 */
export async function getClassFeatures(
    className: string,
    level: number,
    combinedContent: SourcePack['content']
): Promise<Feature[]> {
     if (!className || !combinedContent || level < 1) {
        logMessage('warn', 'getClassFeatures called without className, combinedContent, or invalid level.');
        return [];
    }

    const classData = combinedContent.classes?.[className];
    let allFeatureKeys: string[] = [];

    if (classData?.featuresByLevel) {
        // Preferred approach: Source pack defines features per level
        logMessage('debug', `Found class "${className}" in source packs, accumulating features up to level ${level}.`);
        for (let i = 1; i <= level; i++) {
             if (classData.featuresByLevel[i]) {
                 // Assuming featuresByLevel maps level number to an array of feature keys/names
                allFeatureKeys.push(...classData.featuresByLevel[i]);
             }
        }
    } else {
        // Fallback: Use base definitions (requires manual mapping per level)
        logMessage('debug', `Class "${className}" not found in source packs or lacks featuresByLevel, falling back to base definitions.`);
        switch (className) {
            case 'Fighter':
                if (level >= 1) allFeatureKeys.push('FightingStyleArchery', 'SecondWind');
                if (level >= 2) allFeatureKeys.push('ActionSurge');
                // Add more base fighter levels/features
                break;
            case 'Rogue':
                 if (level >= 1) allFeatureKeys.push('Expertise', 'SneakAttack', 'ThievesCant');
                 if (level >= 2) allFeatureKeys.push('CunningAction');
                // Add more base rogue levels/features
                break;
            case 'Barbarian':
                if (level >= 1) allFeatureKeys.push('UnarmoredDefenseBarbarian' /*, 'Rage'*/);
                 break;
            case 'Monk':
                 if (level >= 1) allFeatureKeys.push('UnarmoredDefenseMonk' /*, 'Martial Arts'*/);
                 break;
             // Add other base classes
             default:
                 logMessage('warn', `No base features defined for class: "${className}"`);
                 allFeatureKeys = [];
        }
    }

     // Fetch the full definitions for the collected keys
     const uniqueFeatureKeys = [...new Set(allFeatureKeys)]; // Ensure uniqueness
     return getMultipleFeatureDefinitions(uniqueFeatureKeys, combinedContent);
}


/**
 * Retrieves features and proficiencies granted by a specific background name, considering source packs.
 * @param backgroundName - The name of the background.
 * @param combinedContent - Combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the background.
 */
export async function getBackgroundFeatures(
    backgroundName: string,
    combinedContent: SourcePack['content']
): Promise<Feature[]> {
     if (!backgroundName || !combinedContent) {
        logMessage('warn', 'getBackgroundFeatures called without backgroundName or combinedContent.');
        return [];
    }

    const backgroundData = combinedContent.backgrounds?.[backgroundName];
    let features: Feature[] = [];

    if (backgroundData) {
        logMessage('debug', `Found background "${backgroundName}" in source packs.`);
        // 1. Add the main background feature if defined
        if (backgroundData.feature) {
             // Try to fetch the full feature definition if only a key is stored
             const mainFeature = await getFeatureDefinition(backgroundData.feature.name, combinedContent);
             if (mainFeature) {
                 // Ensure the source indicates the background
                 features.push({ ...mainFeature, source: `${backgroundName} Background` });
             } else {
                 // Use the basic info from the background data if definition not found
                 features.push({
                    ...backgroundData.feature,
                    source: `${backgroundName} Background`,
                 });
             }
        }

        // 2. Create features for skill proficiencies
        if (backgroundData.skillProficiencies && backgroundData.skillProficiencies.length > 0) {
            features.push({
                name: `${backgroundName} Skill Proficiencies`,
                description: `You gain proficiency in the ${backgroundData.skillProficiencies.join(' and ')} skills.`,
                source: `${backgroundName} Background`,
                metadata: {
                    effectType: 'proficiencyGrant',
                    type: 'skill',
                    proficiencies: backgroundData.skillProficiencies,
                },
            });
        }

        // 3. Create features for tool proficiencies
         if (backgroundData.toolProficiencies && backgroundData.toolProficiencies.length > 0) {
            features.push({
                name: `${backgroundName} Tool Proficiencies`,
                description: `You gain proficiency with ${backgroundData.toolProficiencies.join(' and ')}.`,
                source: `${backgroundName} Background`,
                metadata: {
                    effectType: 'proficiencyGrant',
                    type: 'tool',
                    proficiencies: backgroundData.toolProficiencies,
                },
            });
        }

        // 4. Handle language choices (might need more complex metadata or handling)
         if (backgroundData.languages && backgroundData.languages.choose > 0) {
             features.push({
                name: `${backgroundName} Languages`,
                description: `You can speak, read, and write ${backgroundData.languages.choose} extra language(s) of your choice${backgroundData.languages.options ? ` from: ${backgroundData.languages.options.join(', ')}` : ''}.`,
                source: `${backgroundName} Background`,
                // Metadata could indicate a choice is required
             });
         }

    } else {
        // Fallback to base background features (Simplified Example)
         logMessage('debug', `Background "${backgroundName}" not found in source packs, falling back to base definitions.`);
        switch (backgroundName) {
            case 'Acolyte':
                 const shelterFeature = await getFeatureDefinition('ShelterOfTheFaithful', combinedContent);
                 if (shelterFeature) features.push(shelterFeature);
                 features.push({
                    name: `Acolyte Skill Proficiencies`,
                    description: `You gain proficiency in the Insight and Religion skills.`,
                    source: `Acolyte Background (Base)`,
                    metadata: { effectType: 'proficiencyGrant', type: 'skill', proficiencies: ['Insight', 'Religion'] },
                });
                break;
            // Add other base backgrounds
            default:
                 logMessage('warn', `No base features defined for background: "${backgroundName}"`);
        }
    }

    return features;
}
