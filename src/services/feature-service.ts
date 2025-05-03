'use server';

import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo, Character } from '@/lib/types';
import { logError, logMessage } from './logging-service';
import { ALL_SKILLS } from '@/lib/types'; // Import ALL_SKILLS
import { SRD_SOURCE_PACK } from '@/lib/srd-data'; // Import SRD data

// --- Service Functions ---

/**
 * Fetches the full definition of a feature by its key/name.
 * Prioritizes finding the feature in the provided combinedContent from source packs,
 * then falls back to SRD definitions.
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
             logMessage('debug', `Found feature "${featureKey}" in source pack content.`);
            const featureData = combinedContent.features[featureKey];
            return {
                 name: featureKey,
                 description: featureData.description || '',
                 source: featureData.source || 'Source Pack',
                 metadata: featureData.metadata,
                 isActionable: featureData.isActionable,
                 maxUses: featureData.maxUses,
                 usesResetOn: featureData.usesResetOn,
                 currentUses: featureData.currentUses,
            };
        }

        // 2. Fallback to SRD definitions
        const srdFeatureData = SRD_SOURCE_PACK.content.features?.[featureKey];
        if (srdFeatureData) {
             logMessage('debug', `Found feature "${featureKey}" in SRD definitions.`);
             return {
                 name: featureKey, // Add name explicitly
                 description: srdFeatureData.description || '',
                 source: srdFeatureData.source || 'SRD', // Add source explicitly
                 metadata: srdFeatureData.metadata,
                 isActionable: srdFeatureData.isActionable,
                 maxUses: srdFeatureData.maxUses,
                 usesResetOn: srdFeatureData.usesResetOn,
                 currentUses: srdFeatureData.currentUses,
             };
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
 * Fetches definitions for multiple features, checking combined content first, then SRD.
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
 * Retrieves features granted by a specific race name, considering source packs and SRD.
 * Assumes race definition in packs/SRD might contain feature names/keys.
 * @param raceName - The name of the race.
 * @param combinedContent - Combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the race.
 */
export async function getRaceFeatures(
    raceName: string,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
    if (!raceName) {
        logMessage('warn', 'getRaceFeatures called without raceName.');
        return [];
    }

    // Prioritize combined content, fallback to SRD
    const raceData = combinedContent?.races?.[raceName] ?? SRD_SOURCE_PACK.content.races?.[raceName];
    let featureKeys: string[] = [];

    if (raceData?.traits) {
        featureKeys = raceData.traits;
         logMessage('debug', `Found race "${raceName}" in combined/SRD, fetching features: ${featureKeys.join(', ')}`);
    } else {
        logMessage('warn', `Race "${raceName}" not found or has no traits defined in combined/SRD content.`);
        featureKeys = [];
    }

    // getMultipleFeatureDefinitions handles fallback logic for each feature key
    return getMultipleFeatureDefinitions(featureKeys, combinedContent);
}


/**
 * Retrieves cumulative features granted by a specific class up to a given level.
 * Prioritizes using `featuresByLevel` from combined content, then SRD.
 * @param className - The name of the class.
 * @param level - The character's level in that class.
 * @param combinedContent - Optional combined content from active source packs.
 * @returns A promise resolving to an array of Feature objects for the class/level.
 */
export async function getClassFeatures(
    className: string,
    level: number,
    combinedContent?: SourcePack['content']
): Promise<Feature[]> {
     if (!className || level < 1) {
        logMessage('warn', 'getClassFeatures called without className or invalid level.');
        return [];
    }

    // Prioritize combined content, fallback to SRD
    const classData: CharacterClass | undefined = combinedContent?.classes?.[className] ?? SRD_SOURCE_PACK.content.classes?.[className];
    let usingSource = "SRD"; // Default source identifier

    if (combinedContent?.classes?.[className]) {
        usingSource = "Source Pack";
    }

    if (!classData) {
        logMessage('error', `Class definition not found for "${className}" in combined content or SRD.`);
        return [];
    }

    let allFeatureKeys: string[] = [];
    logMessage('debug', `Accumulating features for ${className} up to level ${level} from ${usingSource}.`);

    if (classData.featuresByLevel) {
        for (let i = 1; i <= level; i++) {
             if (classData.featuresByLevel[i]) {
                allFeatureKeys.push(...classData.featuresByLevel[i]);
             }
        }
    } else {
        logMessage('warn', `Class "${className}" from ${usingSource} lacks 'featuresByLevel' definition.`);
    }

     const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
     logMessage('debug', `Unique feature keys for ${className} level ${level}: ${uniqueFeatureKeys.join(', ')}`);

     if (uniqueFeatureKeys.length === 0) {
        return [];
     }

     try {
        // getMultipleFeatureDefinitions handles combined/SRD fallback for definitions
        return await getMultipleFeatureDefinitions(uniqueFeatureKeys, combinedContent);
     } catch (error) {
         const e = error instanceof Error ? error : new Error(String(error));
         logError(e, {
            function: 'getClassFeatures',
            className: className,
            level: level,
            uniqueFeatureKeys: uniqueFeatureKeys,
         });
        throw new Error(`Failed to fetch features for class ${className}.`);
     }
}


/**
 * Retrieves features and proficiencies granted by a specific background name.
 * Prioritizes definitions from combinedContent, falls back to SRD definitions.
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

    // Prioritize combined content, fallback to SRD
    let backgroundData: BackgroundInfo | null | undefined = combinedContent?.backgrounds?.[backgroundName] ?? SRD_SOURCE_PACK.content.backgrounds?.[backgroundName];
    let usingSource = "SRD";

    if (combinedContent?.backgrounds?.[backgroundName]) {
        usingSource = "Source Pack";
    }

    if (!backgroundData) {
        logMessage('warn', `Background "${backgroundName}" not found in combined content or SRD.`);
        return [];
    }

    logMessage('debug', `Found background "${backgroundName}" in ${usingSource}.`);
    let features: Feature[] = [];

    // --- Add Main Background Feature ---
    if (backgroundData.feature?.name) {
        // getFeatureDefinition handles fallback logic
        const mainFeatureDef = await getFeatureDefinition(backgroundData.feature.name, combinedContent);
        if (mainFeatureDef) {
            // Ensure the source reflects the background itself, not just where the feature was *defined*
            features.push({ ...mainFeatureDef, source: `${backgroundName} Background` });
        } else {
            // Fallback to basic info from backgroundData if full definition missing
            features.push({
                name: backgroundData.feature.name,
                description: backgroundData.feature.description || 'No description.',
                source: `${backgroundName} Background`,
            });
        }
    }

    // --- Add Proficiency Features (from background definition itself) ---
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
                 // Use options from backgroundData or fallback to SRD common languages
                 options: backgroundData.languages.options || SRD_SOURCE_PACK.content.features?.['ExtraLanguage']?.metadata?.options || [],
                 choiceKey: choiceKey,
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
                        const choiceKeyProf = metadata.choiceKey || feature.name;
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
                                     logMessage('warn', `Invalid choice "${chosenProficiencies}" for single proficiency feature "${feature.name}". Options: ${metadata.options?.join(',')}`);
                                }
                            } else {
                                logMessage('warn', `No valid choices found for proficiency feature "${feature.name}" in character data (choiceKey: ${choiceKeyProf}). Choices data: ${JSON.stringify(baseCharacter.featureChoices)}`);
                            }
                        } else {
                            // Grant all listed proficiencies if no choice is needed
                            profsToGrant = metadata.proficiencies || [];
                        }

                        // Add granted proficiencies based on type
                        const addProficiency = (type: keyof typeof finalProficiencies, profs: string[]) => {
                            if (Array.isArray(finalProficiencies[type])) {
                                finalProficiencies[type].push(...profs);
                            }
                        };

                         switch (metadata.type) {
                             case 'armor': addProficiency('armor', profsToGrant); break;
                             case 'weapon': addProficiency('weapons', profsToGrant); break;
                             case 'tool': addProficiency('tools', profsToGrant); break;
                             case 'savingThrow': addProficiency('savingThrows', profsToGrant); break;
                             case 'language': addProficiency('languages', profsToGrant); break;
                             case 'skill':
                                 profsToGrant.forEach(skill => {
                                     if (ALL_SKILLS.includes(skill.toLowerCase())) {
                                         finalSkills[skill.toLowerCase()] = true;
                                     } else {
                                         logMessage('warn', `Granted proficiency for unknown skill '${skill}' by feature '${feature.name}'`);
                                     }
                                 });
                                 break;
                         }
                        break;
                     case 'choiceGrant':
                         logMessage('debug', `ChoiceGrant feature processed (informational): ${feature.name}`);
                         break;
                    case 'acBonus':
                         logMessage('debug', `Informational AC Bonus detected (applied elsewhere): ${feature.name}`);
                         break;
                     case 'acCalculation':
                          logMessage('debug', `Informational AC Calculation detected (applied elsewhere): ${feature.name}`);
                          break;
                    case 'advantage':
                         logMessage('debug', `Informational Advantage detected (applied elsewhere): ${feature.name}`);
                         break;
                     case 'resistance':
                         logMessage('debug', `Informational Resistance detected (applied elsewhere): ${feature.name}`);
                         break;
                    default:
                        const unknownEffectType = (metadata as any).effectType;
                        logMessage('warn', `Unknown or unhandled feature metadata effectType: ${unknownEffectType} for feature ${feature.name}`);
                }
             } catch (error) {
                 const e = error instanceof Error ? error : new Error(String(error));
                 logError(e, {
                    function: 'applyFeatureRules.loop',
                    characterId: baseCharacter.id,
                    featureName: feature.name,
                    effectType: feature.metadata?.effectType,
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

    // Ensure features array in derived character includes currentUses from base if available
    derivedCharacter.features = baseCharacter.features.map(baseFeature => ({
        ...baseFeature,
        currentUses: baseFeature.currentUses, // Carry over current uses
    }));

    logMessage('debug', `Finished applying feature rules for character ${baseCharacter.id}.`);
    return derivedCharacter;
}

    