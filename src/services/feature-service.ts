'use server';

import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo, Character } from '@/lib/types';
import { logError, logMessage } from './logging-service';
import { ALL_SKILLS } from '@/lib/types'; // Import ALL_SKILLS

// --- Rule-Based System for Applying Feature Effects ---

// Type for functions that calculate a specific derived property
type CharacterDerivedPropertyCalculator = (character: Character, baseValue: any) => any;

interface FeatureRule {
    effectType: FeatureEffectMetadata['effectType'];
    // Instead of modifying the character directly, rules provide calculation logic
    // or modify specific derived properties. For stats, we'll calculate bonuses separately.
    // For proficiencies, we'll accumulate them.
    // For AC/Advantage/Resistance, they are informational for later calculations.
}

// --- Base/Placeholder Data (SRD or Core Rules) ---
// This should contain the *definitions* of features referenced by key in source packs.
// This is now primarily a FALLBACK or reference. Feature definitions should ideally come from source packs.
export const BASE_FEATURE_DEFINITIONS: Record<string, Feature> = {
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
        metadata: { // Add metadata for choice
            effectType: "proficiencyGrant",
            type: "language",
            choose: 1,
            // Options could be dynamically populated or hardcoded for SRD
            options: ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"],
            choiceKey: "ExtraLanguage", // Added choiceKey
        }
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

    // Class Features (Definitions)
     "FightingStyle": { // Generic Fighting Style feature
        name: "Fighting Style",
        description: "You adopt a particular style of fighting as your specialty. Choose one option.",
        source: "Fighter Class (Base)",
        metadata: {
            effectType: "choiceGrant",
            choose: 1,
            options: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"], // Example options
            choiceKey: "Fighting Style", // Key to store the choice in Character.featureChoices
        }
    },
    // Specific styles - these might be implicitly activated based on the choice made for the generic "Fighting Style"
    "FightingStyleArchery": {
        name: "Fighting Style: Archery",
        description: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
        source: "Fighter Class (Base)",
        // Note: This bonus needs to be applied during attack roll calculation, not directly to stats. Informational metadata.
        // Consider adding metadata like: { effectType: 'attackBonus', value: 2, condition: 'ranged weapon' }
    },
     "FightingStyleDefense": {
        name: "Fighting Style: Defense",
        description: "While you are wearing armor, you gain a +1 bonus to AC.",
        source: "Fighter Class (Base)",
        metadata: {
            effectType: "acBonus",
            value: 1,
            condition: "wearing armor",
        },
    },
    // ... other specific fighting style definitions ...
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
         metadata: { // Add metadata for choice
             effectType: "proficiencyGrant", // Or potentially 'choiceGrant' if not directly granting proficiency?
             type: 'skill', // Primary type is skill
             choose: 2, // Choose 2 skills OR 1 skill + 1 tool
             options: ALL_SKILLS, // Simplified: Allow choosing from all skills/tools (needs proper tool list)
             choiceKey: "Expertise", // Added choiceKey
             // Needs a way to handle the 'or 1 tool' case - complex metadata required
         }
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
    "Spellcasting": { // Example generic spellcasting feature
        name: "Spellcasting",
        description: "You have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.",
        source: "Wizard Class (Base)" // Source should be specific class
    },
    "ArcaneRecovery": {
        name: "Arcane Recovery",
        description: "You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover.",
        source: "Wizard Class (Base)",
        isActionable: true, // Action happens during short rest
        maxUses: 1,
        usesResetOn: 'long-rest', // Once per day implies long rest reset
    },
     "ArcaneTradition": {
        name: "Arcane Tradition",
        description: "At 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools.",
        source: "Wizard Class (Base)",
        // Metadata might indicate a choice of sub-features/subclass
         metadata: { // Example metadata for subclass choice
             effectType: "choiceGrant",
             choose: 1,
             options: ["School of Abjuration", "School of Conjuration", "School of Divination", "School of Enchantment", "School of Evocation", "School of Illusion", "School of Necromancy", "School of Transmutation"], // Example SRD schools
             choiceKey: "Arcane Tradition",
         }
    },
    "UnarmoredDefenseBarbarian": {
        name: 'Unarmored Defense (Barbarian)',
        description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
        source: 'Barbarian Class (Base)',
        metadata: {
            effectType: 'acCalculation', // Changed from acBonus, needs specific handling
            formula: '10 + dexMod + conMod',
            condition: 'not wearing armor',
        },
    },
    "UnarmoredDefenseMonk": {
        name: 'Unarmored Defense (Monk)',
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        source: 'Monk Class (Base)',
        metadata: {
            effectType: 'acCalculation', // Changed from acBonus
            formula: '10 + dexMod + wisMod',
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
            // Ensure name property exists on the returned object
            return {
                 name: featureKey,
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
            // Ensure name property exists when returning from base definitions
            return { ...BASE_FEATURE_DEFINITIONS[featureKey], name: featureKey };
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
    combinedContent?: SourcePack['content'] // Make optional for flexibility
): Promise<Feature[]> {
    if (!raceName) {
        logMessage('warn', 'getRaceFeatures called without raceName.');
        return [];
    }

    let featureKeys: string[] = [];
    const raceData = combinedContent?.races?.[raceName];

    if (raceData?.traits) {
        featureKeys = raceData.traits;
         logMessage('debug', `Found race "${raceName}" in source packs, fetching features: ${featureKeys.join(', ')}`);
    } else {
         // Optional: Fallback to base definitions if race not in custom packs
         const baseRaceData = BASE_FEATURE_DEFINITIONS[raceName]; // Simple lookup, needs refinement
         if (baseRaceData && Array.isArray((baseRaceData as any).traits)) { // Needs better type check
            logMessage('debug', `Race "${raceName}" not in source packs, falling back to base definitions. Traits: ${(baseRaceData as any).traits.join(', ')}`);
            featureKeys = (baseRaceData as any).traits;
         } else {
             logMessage('warn', `Race "${raceName}" not found in source packs or base definitions, or has no traits defined.`);
             featureKeys = [];
         }
    }

    return getMultipleFeatureDefinitions(featureKeys, combinedContent);
}


/**
 * Retrieves cumulative features granted by a specific class up to a given level.
 * Prioritizes using `featuresByLevel` from source pack definitions if available,
 * otherwise falls back to base definitions.
 * @param className - The name of the class.
 * @param level - The character's level in that class.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the class/level.
 */
export async function getClassFeatures(
    className: string,
    level: number,
    combinedContent?: SourcePack['content'] // Make optional
): Promise<Feature[]> {
     if (!className || level < 1) {
        logMessage('warn', 'getClassFeatures called without className or invalid level.');
        return [];
    }

    let classData: CharacterClass | undefined = combinedContent?.classes?.[className];
    let usingSource = true;

    if (!classData) {
         logMessage('debug', `Class "${className}" not found in source packs, checking base definitions.`);
         // Fallback to base definitions (if you have them)
         // classData = BASE_CLASS_DEFINITIONS[className]; // Assuming BASE_CLASS_DEFINITIONS exists
         usingSource = false;
    }

    if (!classData) {
        logMessage('error', `Class definition not found for "${className}" in source packs or base definitions.`);
        return [];
    }

    let allFeatureKeys: string[] = [];
    logMessage('debug', `Accumulating features for ${className} up to level ${level} ${usingSource ? 'from source pack' : 'from base definitions'}.`);

    if (classData.featuresByLevel) {
        for (let i = 1; i <= level; i++) {
             if (classData.featuresByLevel[i]) {
                allFeatureKeys.push(...classData.featuresByLevel[i]);
             }
        }
    } else {
        logMessage('warn', `Class "${className}" lacks 'featuresByLevel' definition.`);
    }

     const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
     logMessage('debug', `Unique feature keys for ${className} level ${level}: ${uniqueFeatureKeys.join(', ')}`);

     if (uniqueFeatureKeys.length === 0) {
        return [];
     }

     try {
        // Pass combinedContent to ensure feature definitions are checked there first
        return await getMultipleFeatureDefinitions(uniqueFeatureKeys, combinedContent);
     } catch (error) {
         const e = error instanceof Error ? error : new Error(String(error));
         logError(e, {
            function: 'getClassFeatures',
            className: className,
            level: level,
            uniqueFeatureKeys: uniqueFeatureKeys,
         });
        // Consider if throwing is appropriate or returning empty array
        throw new Error(`Failed to fetch features for class ${className}.`);
     }
}


/**
 * Retrieves features and proficiencies granted by a specific background name.
 * Prioritizes definitions from combinedContent, falls back to base definitions.
 * @param backgroundName - The name of the background.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the background.
 */
export async function getBackgroundFeatures(
    backgroundName: string,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
     if (!backgroundName) {
        logMessage('warn', 'getBackgroundFeatures called without backgroundName.');
        return [];
    }

    let backgroundData: BackgroundInfo | null | undefined = combinedContent?.backgrounds?.[backgroundName];
    let usingSource = true;

    if (!backgroundData) {
         logMessage('debug', `Background "${backgroundName}" not found in source packs, checking base definitions.`);
         backgroundData = BASE_FEATURE_DEFINITIONS[backgroundName] as BackgroundInfo | undefined; // Adjust if base features are stored differently
         usingSource = false;
    }

    if (!backgroundData) {
        logMessage('warn', `Background "${backgroundName}" not found in source packs or base definitions.`);
        return [];
    }

    logMessage('debug', `Found background "${backgroundName}" ${usingSource ? 'in source packs' : 'in base definitions'}.`);
    let features: Feature[] = [];

    // --- Add Main Background Feature ---
    if (backgroundData.feature?.name) {
        const mainFeatureDef = await getFeatureDefinition(backgroundData.feature.name, combinedContent);
        if (mainFeatureDef) {
            features.push({ ...mainFeatureDef, source: `${backgroundName} Background` });
        } else {
            // Fallback to basic info if full definition missing
            features.push({
                name: backgroundData.feature.name,
                description: backgroundData.feature.description || 'No description.',
                source: `${backgroundName} Background`,
            });
        }
    }

    // --- Add Proficiency Features ---
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
        const choiceKey = `${backgroundName}Languages`; // Construct a unique key
         features.push({
            name: `${backgroundName} Languages`,
            description: `Choose ${backgroundData.languages.choose} extra language(s)${backgroundData.languages.options ? ` from: ${backgroundData.languages.options.join(', ')}` : ''}.`,
            source: `${backgroundName} Background`,
             metadata: {
                 effectType: "proficiencyGrant",
                 type: "language",
                 choose: backgroundData.languages.choose,
                 options: backgroundData.languages.options || ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"], // Fallback options
                 choiceKey: choiceKey, // Assign the key
             }
         });
     }

    return features;
}



/**
 * Applies the effects of a character's features to their base stats and properties.
 * Returns a new character object with derived values, without modifying the original.
 * This function focuses on calculating bonuses and collecting proficiencies.
 * Complex effects like AC, HP, Advantage, Resistance are noted but calculated elsewhere.
 *
 * IMPORTANT: This function should run on the server or in a secure environment
 * if it relies on sensitive logic or extensive data lookups.
 * If run client-side, ensure `combinedContent` is appropriately fetched and passed.
 *
 * @param baseCharacter - The base character object (should have base stats and FULL feature definitions).
 * @returns A new character object containing the derived state after applying features.
 */
 export async function applyFeatureRules(baseCharacter: Character): Promise<Character> {
    logMessage('debug', `Applying feature rules for character ${baseCharacter.id}`);
    if (!baseCharacter.features || baseCharacter.features.length === 0) {
        logMessage('debug', `No features found for character ${baseCharacter.id}. Returning base character.`);
        return { ...baseCharacter }; // Return a copy
    }

    // Use a deep copy to avoid modifying the original object
    const derivedCharacter = JSON.parse(JSON.stringify(baseCharacter)) as Character;

    // Initialize derived stats and proficiencies based on the BASE character data
    const finalStats = { ...(baseCharacter.stats || {}) }; // Start with base stats
    const finalProficiencies = {
        armor: [...(baseCharacter.proficiencies?.armor ?? [])],
        weapons: [...(baseCharacter.proficiencies?.weapons ?? [])],
        tools: [...(baseCharacter.proficiencies?.tools ?? [])],
        savingThrows: [...(baseCharacter.proficiencies?.savingThrows ?? [])],
        languages: [...(baseCharacter.proficiencies?.languages ?? [])], // Initialize languages
    };
    const finalSkills = { ...(baseCharacter.skills || {}) }; // Start with base skill selections

    // Iterate through features and apply effects based on metadata
    for (const feature of baseCharacter.features) {
        if (feature.metadata) {
             try {
                 const metadata = feature.metadata as FeatureEffectMetadata; // Type assertion

                 // TODO: Add condition checking based on `metadata.condition` before applying effects

                 switch (metadata.effectType) {
                    case 'statBonus':
                        Object.entries(metadata.stats).forEach(([stat, bonus]) => {
                            if (finalStats[stat as keyof typeof finalStats] !== undefined) {
                                finalStats[stat as keyof typeof finalStats] += bonus;
                            } else {
                                 logMessage('warn', `Attempted to apply stat bonus to non-existent stat '${stat}' for feature '${feature.name}'`);
                            }
                        });
                        break;
                    case 'proficiencyGrant':
                        const choiceKeyProf = metadata.choiceKey || feature.name; // Use choiceKey or feature name
                        const chosenProficiencies = baseCharacter.featureChoices?.[choiceKeyProf];

                        let profsToGrant: string[] = [];
                        if (metadata.choose && metadata.options) {
                            // Grant only the chosen proficiencies
                            if (chosenProficiencies && Array.isArray(chosenProficiencies)) {
                                profsToGrant = chosenProficiencies.filter(choice => metadata.options?.includes(choice));
                                if (profsToGrant.length !== metadata.choose) {
                                    logMessage('warn', `Incorrect number of choices made for proficiency feature "${feature.name}". Expected ${metadata.choose}, got ${profsToGrant.length}. Choices: ${chosenProficiencies.join(', ')}`);
                                }
                            } else if (chosenProficiencies && typeof chosenProficiencies === 'string' && metadata.choose === 1) {
                                // Handle single choice stored as string
                                if (metadata.options?.includes(chosenProficiencies)) {
                                     profsToGrant = [chosenProficiencies];
                                } else {
                                     logMessage('warn', `Invalid choice "${chosenProficiencies}" for single proficiency feature "${feature.name}".`);
                                }
                            } else {
                                logMessage('warn', `No valid choices found for proficiency feature "${feature.name}" in character data (choiceKey: ${choiceKeyProf}). Choices data: ${JSON.stringify(baseCharacter.featureChoices)}`);
                            }
                        } else {
                            // Grant all listed proficiencies if no choice is needed
                            profsToGrant = metadata.proficiencies || [];
                        }

                        switch (metadata.type) {
                            case 'armor': finalProficiencies.armor.push(...profsToGrant); break;
                            case 'weapon': finalProficiencies.weapons.push(...profsToGrant); break;
                            case 'tool': finalProficiencies.tools.push(...profsToGrant); break;
                            case 'savingThrow': finalProficiencies.savingThrows.push(...profsToGrant); break;
                            case 'skill':
                                profsToGrant.forEach(skill => { finalSkills[skill.toLowerCase()] = true; });
                                break;
                            case 'language': finalProficiencies.languages.push(...profsToGrant); break; // Add languages
                        }
                        break;
                     case 'choiceGrant':
                         // If the choice itself grants a specific feature (like a Fighting Style),
                         // that specific feature should have its own metadata applied.
                         // This 'choiceGrant' itself doesn't directly apply stats/proficiencies here,
                         // it just flags that a choice was made (handled during character save).
                         logMessage('debug', `ChoiceGrant feature processed: ${feature.name}`);
                         break;
                    // Cases for 'acBonus', 'advantage', 'resistance' are informational
                    // Their effects are calculated contextually (e.g., in CharacterSheet, CombatTracker)
                    case 'acBonus':
                         logMessage('debug', `Informational AC Bonus detected: ${feature.name}`);
                         break;
                     case 'acCalculation': // Informational tag for special AC calculation
                          logMessage('debug', `Informational AC Calculation detected: ${feature.name}`);
                          break;
                    case 'advantage':
                         logMessage('debug', `Informational Advantage detected: ${feature.name}`);
                         break;
                     case 'resistance':
                         logMessage('debug', `Informational Resistance detected: ${feature.name}`);
                         break;
                    default:
                        // Use a type assertion to help TypeScript, but be cautious
                        const unknownEffectType = (metadata as any).effectType;
                        logMessage('warn', `Unknown or unhandled feature metadata effectType: ${unknownEffectType} for feature ${feature.name}`);
                }
             } catch (error) {
                 const e = error instanceof Error ? error : new Error(String(error));
                 logError(e, {
                    function: 'applyFeatureRules.loop',
                    characterId: baseCharacter.id,
                    featureName: feature.name,
                    effectType: feature.metadata?.effectType, // Access safely
                 });
             }
        }
    }

    // --- Final Object Construction ---
    // Combine the base character with the *final calculated* properties
    derivedCharacter.stats = finalStats; // Store the FINAL stats after bonuses
    derivedCharacter.proficiencies = { // Store the final list of proficiencies
        armor: [...new Set(finalProficiencies.armor)],
        weapons: [...new Set(finalProficiencies.weapons)],
        tools: [...new Set(finalProficiencies.tools)],
        savingThrows: [...new Set(finalProficiencies.savingThrows)],
        languages: [...new Set(finalProficiencies.languages)], // Add languages
    };
    derivedCharacter.skills = finalSkills; // Store final skill proficiency map
    // Feature choices are already part of the baseCharacter and thus derivedCharacter

    // Ensure features array in derived character includes currentUses from base if available
    derivedCharacter.features = baseCharacter.features.map(baseFeature => ({
        ...baseFeature,
        currentUses: baseFeature.currentUses, // Carry over current uses
    }));


    // Note: HP, AC, Initiative, Speed, etc., are calculated dynamically based on the
    // final stats, features, and equipment in the component displaying the character (e.g., CharacterSheet).
    // We don't store these derived combat values directly in the Character object via this function.

    logMessage('debug', `Finished applying feature rules for character ${baseCharacter.id}.`);
    return derivedCharacter;
}
