
'use server';

import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo, Character } from '@/lib/types';
import { logError, logMessage } from './logging-service';

// --- Rule-Based System for Applying Feature Effects ---

type CharacterStateModifier = (character: Character, metadata: FeatureEffectMetadata) => Partial<Character>;

interface FeatureRule {
    effectType: FeatureEffectMetadata['effectType'];
    apply: CharacterStateModifier;
    // Optional: Add priority for ordering complex interactions later if needed
    // priority?: number;
}

// Rule implementations
const statBonusRule: FeatureRule = {
    effectType: 'statBonus',
    apply: (character, metadata) => {
        if (metadata.effectType !== 'statBonus') return {};
        const updatedStats = { ...character.stats };
        Object.entries(metadata.stats).forEach(([stat, bonus]) => {
            if (updatedStats[stat as keyof typeof updatedStats]) {
                updatedStats[stat as keyof typeof updatedStats] += bonus;
            }
        });
        return { stats: updatedStats };
    }
};

const proficiencyGrantRule: FeatureRule = {
    effectType: 'proficiencyGrant',
    apply: (character, metadata) => {
        if (metadata.effectType !== 'proficiencyGrant') return {};
        const updatedProficiencies = {
            armor: [...(character.proficiencies?.armor || [])],
            weapons: [...(character.proficiencies?.weapons || [])],
            tools: [...(character.proficiencies?.tools || [])],
            savingThrows: [...(character.proficiencies?.savingThrows || [])],
        };
        const updatedSkills = { ...(character.skills || {}) };

        switch (metadata.type) {
            case 'armor':
                updatedProficiencies.armor.push(...metadata.proficiencies);
                break;
            case 'weapon':
                updatedProficiencies.weapons.push(...metadata.proficiencies);
                break;
            case 'tool':
                updatedProficiencies.tools.push(...metadata.proficiencies);
                break;
            case 'savingThrow':
                updatedProficiencies.savingThrows.push(...metadata.proficiencies);
                break;
            case 'skill':
                 // TODO: Handle choices if metadata.choose is present
                metadata.proficiencies.forEach(skill => {
                    updatedSkills[skill.toLowerCase()] = true;
                });
                break;
        }
        // Ensure uniqueness within the returned update
        return {
             proficiencies: {
                 armor: [...new Set(updatedProficiencies.armor)],
                 weapons: [...new Set(updatedProficiencies.weapons)],
                 tools: [...new Set(updatedProficiencies.tools)],
                 savingThrows: [...new Set(updatedProficiencies.savingThrows)],
             },
             skills: updatedSkills
        };
    }
};

// Note: ACBonus, Advantage, Resistance rules currently don't modify the base character state directly.
// They are informational for calculation elsewhere (like AC calculation or roll checks).
// We can add them here if we decide to store derived states like "hasAdvantageAgainstCharm".
const acBonusRule: FeatureRule = {
    effectType: 'acBonus',
    apply: (character, metadata) => {
        // Placeholder: AC is calculated later based on features, equipment, etc.
        // This rule could potentially add a temporary flag or modify a derived acBonus field if we had one.
        // console.log(`Informational: AC bonus feature found: +${metadata.value} (${metadata.condition})`);
        return {};
    }
};

const advantageGrantRule: FeatureRule = {
    effectType: 'advantage',
    apply: (character, metadata) => {
        // Placeholder: Informational for UI/combat tracker.
        // console.log(`Informational: Advantage feature found on ${metadata.target} (${metadata.condition})`);
        return {};
    }
};

const resistanceGrantRule: FeatureRule = {
    effectType: 'resistance',
    apply: (character, metadata) => {
        // Placeholder: Informational for UI/combat tracker.
        // console.log(`Informational: Resistance feature found to ${metadata.damageType}`);
        return {};
    }
};

// Rule Registry
const FEATURE_RULES: Record<FeatureEffectMetadata['effectType'], FeatureRule> = {
    statBonus: statBonusRule,
    proficiencyGrant: proficiencyGrantRule,
    acBonus: acBonusRule,
    advantage: advantageGrantRule,
    resistance: resistanceGrantRule,
    // Add other rules here as they are implemented
};

// --- Base/Placeholder Data (SRD or Core Rules) ---

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
        // Combined advantage and resistance - advantage rule could be separate if needed
    },
    "Stonecunning": {
        name: "Stonecunning",
        description: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.",
        source: "Dwarf Race (Base)",
        // Note: Expertise/double proficiency bonus needs specific handling, possibly a new metadata type or logic in skill calculation
    },
    "Lucky": {
        name: "Lucky",
        description: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
        source: "Halfling Race (Base)",
        isActionable: true, // Or maybe passive reaction?
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
        // Note: This bonus needs to be applied during attack roll calculation, not directly to stats. Informational metadata.
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
        // Requires player choice, metadata might indicate this. Expertise effect handled in skill calculation.
    },
    "SneakAttack": {
        name: "Sneak Attack",
        description: "Once per turn, you can deal extra damage (scales with level) to one creature you hit with an attack under certain conditions.",
        source: "Rogue Class (Base)",
         // Damage calculation handled elsewhere.
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
            effectType: 'acBonus', // Informational: AC calculation logic needs to check for this feature name
            value: 0, // Value isn't a simple bonus
            condition: 'not wearing armor',
        },
    },
    "UnarmoredDefenseMonk": {
        name: 'Unarmored Defense (Monk)',
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        source: 'Monk Class (Base)',
        metadata: {
            effectType: 'acBonus', // Informational
            value: 0,
            condition: 'not wearing armor and not wielding a shield',
        },
    },
    // Base Background Feature Examples
    "ShelterOfTheFaithful": {
        name: "Shelter of the Faithful",
        description: "As an acolyte, you command the respect of those who share your faith...",
        source: "Acolyte Background (Base)",
    },
     "CitySecrets": {
        name: "City Secrets",
        description: "You know the secret patterns and flow of cities...",
        source: "Urchin Background (Base)",
    },
    "MilitaryRank": {
        name: "Military Rank",
        description: "You have a military rank from your career as a soldier...",
        source: "Soldier Background (Base)",
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
        // 1. Check combined content first (assuming features are keyed by name/key)
        if (combinedContent?.features && combinedContent.features[featureKey]) {
             logMessage('debug', `Found feature "${featureKey}" in source pack content.`);
            const featureData = combinedContent.features[featureKey];
            return {
                 name: featureKey, // Ensure name is the key
                 description: featureData.description || '',
                 source: featureData.source || 'Source Pack', // Use pack source or default
                 metadata: featureData.metadata,
                 isActionable: featureData.isActionable,
                 maxUses: featureData.maxUses,
                 usesResetOn: featureData.usesResetOn,
                 currentUses: featureData.currentUses, // Should ideally be managed in Character state
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
        featureKeys = raceData.traits;
         logMessage('debug', `Found race "${raceName}" in source packs, fetching features: ${featureKeys.join(', ')}`);
    } else {
         logMessage('debug', `Race "${raceName}" not found in source packs or has no traits defined, falling back to base definitions.`);
        switch (raceName) {
            case 'Human': featureKeys = ['HumanASI', 'ExtraLanguage']; break;
            case 'Elf': featureKeys = ['Darkvision', 'FeyAncestry', 'Trance']; break;
            case 'Dwarf': featureKeys = ['Darkvision', 'DwarvenResilience', 'Stonecunning']; break;
            case 'Halfling': featureKeys = ['Lucky', 'Brave', 'HalflingNimbleness']; break;
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
        logMessage('debug', `Found class "${className}" in source packs, accumulating features up to level ${level}.`);
        for (let i = 1; i <= level; i++) {
             if (classData.featuresByLevel[i]) {
                allFeatureKeys.push(...classData.featuresByLevel[i]);
             }
        }
    } else {
        logMessage('debug', `Class "${className}" not found in source packs or lacks featuresByLevel, falling back to base definitions.`);
        switch (className) {
            case 'Fighter':
                if (level >= 1) allFeatureKeys.push('FightingStyleArchery', 'SecondWind');
                if (level >= 2) allFeatureKeys.push('ActionSurge');
                break;
            case 'Rogue':
                 if (level >= 1) allFeatureKeys.push('Expertise', 'SneakAttack', 'ThievesCant');
                 if (level >= 2) allFeatureKeys.push('CunningAction');
                break;
            case 'Barbarian':
                if (level >= 1) allFeatureKeys.push('UnarmoredDefenseBarbarian' /*, 'Rage'*/);
                 break;
            case 'Monk':
                 if (level >= 1) allFeatureKeys.push('UnarmoredDefenseMonk' /*, 'Martial Arts'*/);
                 break;
             default:
                 logMessage('warn', `No base features defined for class: "${className}"`);
                 allFeatureKeys = [];
        }
    }

     const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
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
        if (backgroundData.feature) {
             const mainFeatureDef = await getFeatureDefinition(backgroundData.feature.name, combinedContent);
             if (mainFeatureDef) {
                 features.push({ ...mainFeatureDef, source: `${backgroundName} Background` });
             } else {
                 features.push({ // Fallback if full definition not found
                    ...backgroundData.feature,
                    source: `${backgroundName} Background`,
                 });
             }
        }
        if (backgroundData.skillProficiencies && backgroundData.skillProficiencies.length > 0) {
            features.push({
                name: `${backgroundName} Skill Proficiencies`,
                description: `Gain proficiency in ${backgroundData.skillProficiencies.join(' and ')}.`,
                source: `${backgroundName} Background`,
                metadata: { effectType: 'proficiencyGrant', type: 'skill', proficiencies: backgroundData.skillProficiencies },
            });
        }
         if (backgroundData.toolProficiencies && backgroundData.toolProficiencies.length > 0) {
            features.push({
                name: `${backgroundName} Tool Proficiencies`,
                description: `Gain proficiency with ${backgroundData.toolProficiencies.join(' and ')}.`,
                source: `${backgroundName} Background`,
                metadata: { effectType: 'proficiencyGrant', type: 'tool', proficiencies: backgroundData.toolProficiencies },
            });
        }
         if (backgroundData.languages && backgroundData.languages.choose > 0) {
             features.push({
                name: `${backgroundName} Languages`,
                description: `Choose ${backgroundData.languages.choose} extra language(s)${backgroundData.languages.options ? ` from: ${backgroundData.languages.options.join(', ')}` : ''}.`,
                source: `${backgroundName} Background`,
             });
         }
    } else {
         logMessage('debug', `Background "${backgroundName}" not found in source packs, falling back to base definitions.`);
        switch (backgroundName) {
            case 'Acolyte':
                 const shelterFeature = await getFeatureDefinition('ShelterOfTheFaithful', combinedContent);
                 if (shelterFeature) features.push({ ...shelterFeature, source: 'Acolyte Background (Base)'});
                 features.push({
                    name: `Acolyte Skill Proficiencies`,
                    description: `Gain proficiency in Insight and Religion.`,
                    source: `Acolyte Background (Base)`,
                    metadata: { effectType: 'proficiencyGrant', type: 'skill', proficiencies: ['Insight', 'Religion'] },
                });
                features.push({
                    name: `Acolyte Languages`,
                    description: `Choose 2 extra languages.`,
                    source: `Acolyte Background (Base)`,
                });
                break;
            default:
                 logMessage('warn', `No base features defined for background: "${backgroundName}"`);
        }
    }

    return features;
}


/**
 * Applies the effects of a character's features using the rule-based system.
 * This modifies the character object *in place* based on feature metadata rules.
 *
 * @param character - The character object to apply effects to.
 * @returns The modified character object.
 */
export async function applyFeatureRules(character: Character): Promise<Character> {
    logMessage('debug', `Applying feature rules for character ${character.id}`);
    if (!character.features || character.features.length === 0) {
        logMessage('debug', `No features found for character ${character.id}. Returning base character.`);
        return character;
    }

    let modifiedCharacter = JSON.parse(JSON.stringify(character)) as Character; // Deep copy

    for (const feature of modifiedCharacter.features) {
        if (feature.metadata) {
            const rule = FEATURE_RULES[feature.metadata.effectType];
            if (rule) {
                try {
                    const updates = rule.apply(modifiedCharacter, feature.metadata);
                    // Merge updates cautiously
                    if (updates.stats) {
                        modifiedCharacter.stats = { ...modifiedCharacter.stats, ...updates.stats };
                    }
                    if (updates.proficiencies) {
                         modifiedCharacter.proficiencies.armor = [...new Set([...modifiedCharacter.proficiencies.armor, ...(updates.proficiencies.armor || [])])];
                         modifiedCharacter.proficiencies.weapons = [...new Set([...modifiedCharacter.proficiencies.weapons, ...(updates.proficiencies.weapons || [])])];
                         modifiedCharacter.proficiencies.tools = [...new Set([...modifiedCharacter.proficiencies.tools, ...(updates.proficiencies.tools || [])])];
                         modifiedCharacter.proficiencies.savingThrows = [...new Set([...modifiedCharacter.proficiencies.savingThrows, ...(updates.proficiencies.savingThrows || [])])];
                    }
                     if (updates.skills) {
                         modifiedCharacter.skills = { ...modifiedCharacter.skills, ...updates.skills };
                    }
                    // Add merging for other potential updates (resistances, advantages, etc.) if rules modify them directly
                } catch (error) {
                     const e = error instanceof Error ? error : new Error(String(error));
                     logError(e, {
                        function: 'applyFeatureRules',
                        characterId: character.id,
                        featureName: feature.name,
                        effectType: feature.metadata.effectType,
                     });
                      // Decide whether to continue applying other rules or stop
                }
            } else {
                logMessage('warn', `No rule found for effectType: ${feature.metadata.effectType} in feature ${feature.name}`);
            }
        }
    }

     // Final cleanup/calculations after all rules applied (e.g., ensuring unique proficiencies again)
     modifiedCharacter.proficiencies.armor = [...new Set(modifiedCharacter.proficiencies.armor)];
     modifiedCharacter.proficiencies.weapons = [...new Set(modifiedCharacter.proficiencies.weapons)];
     modifiedCharacter.proficiencies.tools = [...new Set(modifiedCharacter.proficiencies.tools)];
     modifiedCharacter.proficiencies.savingThrows = [...new Set(modifiedCharacter.proficiencies.savingThrows)];

    // AC, HP, Speed etc. should be calculated separately based on the final character state + equipment
    logMessage('debug', `Finished applying feature rules for character ${character.id}.`);
    return modifiedCharacter;
}
