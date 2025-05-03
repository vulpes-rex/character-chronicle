
import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo, Character, SpellcastingGrantMetadata, NPC, Monster } from '@/lib/types';
import { logError, logMessage } from './logging-service';
import { ALL_SKILLS, SKILL_ABILITY_MAP, SPELL_SLOTS_BY_LEVEL } from '@/lib/types'; // Import constants
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
        await logError(e, {
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
         await logError(e, {
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
 * Calculates the modifier for a given skill.
 * Considers base ability score, proficiency bonus if applicable, and potential expertises (not yet fully implemented).
 *
 * @param skillName - The name of the skill (e.g., "athletics").
 * @param stats - The character's ability scores (STR, DEX, etc.).
 * @param proficient - Whether the character is proficient in the skill.
 * @param proficiencyBonus - The character's proficiency bonus.
 * @param expertiseFeatures - Optional array of features to check for Expertise.
 * @returns The calculated skill modifier.
 */
export function calculateSkillModifier(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined,
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[] // Optional: Pass features that grant expertise
): number {
    const skillLower = skillName.toLowerCase();
    const ability = SKILL_ABILITY_MAP[skillLower];

    if (!stats) {
        logMessage('warn', `Stats object is missing for skill calculation: ${skillName}.`);
        return 0;
    }

    // Handle direct skill modifiers from monsters/NPCs if available (these override calculation)
    if ('skills' in stats && stats.skills && typeof stats.skills[skillLower] === 'number') {
        return stats.skills[skillLower] as number;
    }

    // Calculate based on ability score if skill override not present
    if (!ability || typeof stats[ability] !== 'number') {
        if (!ability) {
            logMessage('warn', `Could not find ability mapping for skill: ${skillName}.`);
        }
        return 0;
    }

    const abilityModifier = Math.floor((stats[ability]! - 10) / 2);
    let proficiencyValue = proficient ? proficiencyBonus : 0;

    // Check for Expertise (Simple check, needs robust choice tracking)
    // if (proficient && expertiseFeatures) {
    //     expertiseFeatures.forEach(feature => {
    //         if (feature.name === 'Expertise' && feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.type === 'skill') {
    //              // TODO: Check if *this specific skill* was chosen for Expertise
    //              // This requires accessing Character.featureChoices based on feature.metadata.choiceKey
    //              // For now, assume expertise applies if the feature exists and character is proficient
    //              // proficiencyValue = proficiencyBonus * 2;
    //              console.log(`Note: Expertise potentially applies to ${skillName}, but choice checking is not fully implemented.`);
    //         }
    //     });
    // }

    return abilityModifier + proficiencyValue;
};

/**
 * Applies the effects of a character's features to their base stats and properties.
 * Returns a new character object with derived values, without modifying the original.
 * This function calculates bonuses, proficiencies, AC, HP, and spellcasting details.
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
        languages: [...(baseCharacter.proficiencies?.languages ?? [])],
    };
    const finalSkills = { ...(baseCharacter.skills || {}) }; // Start with base skill selections

    // Spellcasting details initialization
    let spellcastingAbility: keyof Character['stats'] | null = null;
    let spellProgression: CharacterClass['spellProgression'] = 'none';
    let knownSpellsFromFeatures: string[] = [];

    // Iterate through features and apply effects based on metadata
    for (const feature of baseCharacter.features) {
        if (feature.metadata) {
            try {
                const metadata = feature.metadata as FeatureEffectMetadata;

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
                            if (chosenProficiencies && Array.isArray(chosenProficiencies)) {
                                profsToGrant = chosenProficiencies.filter(choice => metadata.options?.includes(choice));
                            } else if (chosenProficiencies && typeof chosenProficiencies === 'string' && metadata.choose === 1) {
                                if (metadata.options?.includes(chosenProficiencies)) profsToGrant = [chosenProficiencies];
                            } else {
                                logMessage('warn', `No/Invalid choices for feature "${feature.name}" (key: ${choiceKeyProf}). Choices: ${JSON.stringify(baseCharacter.featureChoices)}`);
                            }
                        } else {
                            profsToGrant = metadata.proficiencies || [];
                        }

                        const addProficiency = (type: keyof typeof finalProficiencies, profs: string[]) => {
                             if (Array.isArray(finalProficiencies[type])) { finalProficiencies[type].push(...profs); }
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
                                    } else { logMessage('warn', `Granted proficiency for unknown skill '${skill}' by feature '${feature.name}'`); }
                                });
                                break;
                        }
                        break;
                    case 'spellcastingGrant':
                         // Prioritize class spellcasting ability if multiple features grant it
                         if (!spellcastingAbility || feature.source.includes('Class')) { // Simple check for class source
                            spellcastingAbility = (metadata as SpellcastingGrantMetadata).ability;
                            const classData = SRD_SOURCE_PACK.content.classes?.[baseCharacter.class]; // Look up class progression
                            spellProgression = (metadata as SpellcastingGrantMetadata).preparationType === 'known'
                                ? 'known' // Assume known if specified, else check class
                                : (metadata as SpellcastingGrantMetadata).preparationType === 'prepared'
                                    ? 'prepared'
                                    : classData?.spellProgression || 'none';
                         }
                         break;
                     case 'spellsKnownGrant':
                        if (metadata.spells) {
                            knownSpellsFromFeatures.push(...metadata.spells);
                        }
                        break;
                    // Informational types handled elsewhere (AC, Advantage, Resistance, ChoiceGrant)
                    case 'acBonus':
                    case 'acCalculation':
                    case 'advantage':
                    case 'resistance':
                    case 'choiceGrant':
                         logMessage('debug', `Informational feature processed (applied elsewhere): ${feature.name} (${metadata.effectType})`);
                        break;
                    default:
                        const unknownEffectType = (metadata as any).effectType;
                        logMessage('warn', `Unknown or unhandled feature metadata effectType: ${unknownEffectType} for feature ${feature.name}`);
                }
            } catch (error) {
                const e = error instanceof Error ? error : new Error(String(error));
                await logError(e, { function: 'applyFeatureRules.loop', characterId: baseCharacter.id, featureName: feature.name, effectType: feature.metadata?.effectType });
            }
        }
    }

    // --- Final Calculations (Post-Feature Application) ---

    // Ensure unique proficiencies
    derivedCharacter.proficiencies = {
        armor: [...new Set(finalProficiencies.armor)],
        weapons: [...new Set(finalProficiencies.weapons)],
        tools: [...new Set(finalProficiencies.tools)],
        savingThrows: [...new Set(finalProficiencies.savingThrows)],
        languages: [...new Set(finalProficiencies.languages)],
    };
    derivedCharacter.skills = finalSkills; // Store final skill proficiency map

    // Apply final stats (affected by features)
    derivedCharacter.stats = finalStats;
    const finalModifiers = {
        strength: Math.floor((finalStats.strength - 10) / 2),
        dexterity: Math.floor((finalStats.dexterity - 10) / 2),
        constitution: Math.floor((finalStats.constitution - 10) / 2),
        intelligence: Math.floor((finalStats.intelligence - 10) / 2),
        wisdom: Math.floor((finalStats.wisdom - 10) / 2),
        charisma: Math.floor((finalStats.charisma - 10) / 2),
    };

    // Calculate Final AC
    let calculatedAC = 10;
    let armorDexMod = finalModifiers.dexterity;
    let maxDex: number | null = null;
    let hasShield = false;
    let armorEquipped = false;
    let unarmoredDefenseValue: number | null = null;

    derivedCharacter.equipment
        .filter(item => item.isEquipped && item.type === 'Armor')
        .forEach(item => {
            if (item.armorCategory === 'Shield') { hasShield = true; }
            else if (!armorEquipped && item.baseAC !== undefined) {
                calculatedAC = item.baseAC;
                if (item.addDexModifier === false) armorDexMod = 0;
                maxDex = item.maxDexBonus ?? null;
                armorEquipped = true;
            }
        });

    derivedCharacter.features.forEach(f => {
        const metadata = f.metadata as FeatureEffectMetadata | undefined;
        if (metadata?.effectType === 'acCalculation') {
             const conditionMet =
                (metadata.condition === 'not wearing armor' && !armorEquipped) ||
                (metadata.condition === 'not wearing armor and not wielding a shield' && !armorEquipped && !hasShield) ||
                 !metadata.condition;

             if (conditionMet && unarmoredDefenseValue === null) {
                 if (metadata.formula === '10 + dexMod + conMod') { unarmoredDefenseValue = 10 + finalModifiers.dexterity + finalModifiers.constitution; }
                 else if (metadata.formula === '10 + dexMod + wisMod') { unarmoredDefenseValue = 10 + finalModifiers.dexterity + finalModifiers.wisdom; }
            }
        }
    });

    if (unarmoredDefenseValue !== null) {
        calculatedAC = unarmoredDefenseValue;
        armorDexMod = 0;
    } else if (!armorEquipped) {
        calculatedAC = 10; // Default unarmored
        armorDexMod = finalModifiers.dexterity;
    }

    if (maxDex !== null) armorDexMod = Math.min(armorDexMod, maxDex);
    calculatedAC += armorDexMod;
    if (hasShield) calculatedAC += 2;

    derivedCharacter.features.forEach(f => {
        const metadata = f.metadata as FeatureEffectMetadata | undefined;
        if (metadata?.effectType === 'acBonus') {
             const conditionMet = metadata.condition === 'wearing armor' ? armorEquipped : true;
             if (conditionMet && metadata.value) calculatedAC += metadata.value;
        }
    });
    // Note: Storing calculatedAC is not standard, it's usually calculated on the fly.
    // We don't add it to the Character object.

    // Calculate Max HP based on final CON modifier
    // (Simplified: assumes average roll for levels after 1st, needs class hit die)
     const conMod = finalModifiers.constitution;
     const classData = SRD_SOURCE_PACK.content.classes?.[baseCharacter.class]; // Fetch class data again for hit die
     let maxHp = 0;
     if (classData) {
         const hitDieSides = parseInt(classData.hitDie.substring(1), 10);
         maxHp = hitDieSides + conMod; // Level 1 HP
         if (baseCharacter.level > 1) {
             maxHp += (baseCharacter.level - 1) * (Math.ceil((hitDieSides + 1) / 2) + conMod); // Average for subsequent levels
         }
         maxHp = Math.max(1, maxHp); // Minimum 1 HP
     } else {
         logMessage('warn', `Could not calculate max HP for ${baseCharacter.id}: Class data not found.`);
         maxHp = baseCharacter.hitPoints.max; // Fallback to existing max HP
     }
     // Update hit points, preserving current/temp unless max decreased below current
     derivedCharacter.hitPoints = {
         max: maxHp,
         current: Math.min(baseCharacter.hitPoints.current, maxHp),
         temporary: baseCharacter.hitPoints.temporary,
     };

    // Set Hit Dice details
    derivedCharacter.hitDice = {
        total: baseCharacter.level,
        remaining: Math.min(baseCharacter.hitDice.remaining, baseCharacter.level), // Cap remaining at total
        dieType: classData?.hitDie || null,
    };

    // Apply Spellcasting Details
    if (spellcastingAbility) {
        const spellAbilityMod = finalModifiers[spellcastingAbility] ?? 0;
        const profBonus = baseCharacter.level >= 17 ? 6 : baseCharacter.level >= 13 ? 5 : baseCharacter.level >= 9 ? 4 : baseCharacter.level >= 5 ? 3 : 2;

        derivedCharacter.spellcasting = {
            ability: spellcastingAbility,
            spellSaveDC: 8 + profBonus + spellAbilityMod,
            spellAttackBonus: profBonus + spellAbilityMod,
            slots: {}, // Initialize slots
        };

        // Determine spell slots based on progression type and level
        const progressionKey = spellProgression === 'known' || spellProgression === 'prepared' ? 'full' : spellProgression; // Map known/prepared to full for slots table for now
        const slotsTable = SPELL_SLOTS_BY_LEVEL[progressionKey || 'none'];
        if (slotsTable && baseCharacter.level > 0 && baseCharacter.level <= slotsTable.length) {
             const levelSlots = slotsTable[baseCharacter.level - 1];
             levelSlots.forEach((maxSlots, index) => {
                 const spellLevel = index + 1;
                 if (maxSlots > 0) {
                    derivedCharacter.spellcasting!.slots[String(spellLevel)] = {
                         max: maxSlots,
                         // Preserve remaining slots if they exist from baseCharacter, otherwise default to max
                         remaining: baseCharacter.spellcasting?.slots?.[String(spellLevel)]?.remaining ?? maxSlots,
                     };
                 }
             });
         } else if (spellProgression !== 'none') {
             logMessage('warn', `Could not determine spell slots for level ${baseCharacter.level} and progression '${progressionKey}'`);
         }
         // Combine explicitly known/prepared spells with those granted by features
         derivedCharacter.spellsKnown = [...new Set([...(baseCharacter.spellsKnown || []), ...knownSpellsFromFeatures])];
         derivedCharacter.spellsPrepared = [...new Set(baseCharacter.spellsPrepared || [])]; // Keep only explicitly prepared

     } else {
         derivedCharacter.spellcasting = undefined; // Remove if no spellcasting ability found
     }

    // Ensure features array in derived character includes currentUses from base if available
    derivedCharacter.features = baseCharacter.features.map(baseFeature => ({
        ...baseFeature,
        // If currentUses was provided in baseCharacter (e.g., loaded from DB), use it.
        // Otherwise, default to maxUses if applicable.
        currentUses: baseFeature.currentUses ?? baseFeature.maxUses ?? undefined,
    }));

    logMessage('debug', `Finished applying feature rules for character ${baseCharacter.id}.`);
    return derivedCharacter;
}
