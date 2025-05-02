
'use server';

import type { Feature, FeatureEffectMetadata } from '@/lib/types';

// --- Placeholder Data (Replace with Database/API calls) ---

// Example feature definitions including metadata
const FEATURE_DEFINITIONS: Record<string, Feature> = {
    // Race Features
    "HumanASI": {
        name: "Ability Score Increase",
        description: "Your ability scores each increase by 1.",
        source: "Human Race",
        metadata: {
            effectType: "statBonus",
            stats: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
        }
    },
    "ExtraLanguage": {
        name: "Extra Language",
        description: "You can speak, read, and write one extra language of your choice.",
        source: "Human Race",
        // Metadata could potentially indicate a choice needs to be made
    },
    "Darkvision": {
        name: "Darkvision",
        description: "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.",
        source: "Elf/Dwarf Race",
        // Passive effect, potentially metadata for range/type if needed for automation
    },
    "FeyAncestry": {
        name: "Fey Ancestry",
        description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
        source: "Elf Race",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being charmed",
        }
    },
    "Trance": {
        name: "Trance",
        description: "Elves don’t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.",
        source: "Elf Race",
        // Passive effect related to rest mechanics
    },
    "DwarvenResilience": {
        name: "Dwarven Resilience",
        description: "You have advantage on saving throws against poison, and you have resistance against poison damage.",
        source: "Dwarf Race",
        metadata: {
            effectType: "resistance", // Could combine advantage/resistance metadata if needed
            damageType: "Poison",
            // Also provides advantage: { effectType: "advantage", target: "savingThrow", condition: "against poison" }
        }
    },
    "Stonecunning": {
        name: "Stonecunning",
        description: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.",
        source: "Dwarf Race",
        // Complex effect: Proficiency + Expertise on specific checks
    },
    "Lucky": {
        name: "Lucky",
        description: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
        source: "Halfling Race",
        isActionable: true, // Reaction-based
        maxUses: null,
        usesResetOn: null,
        // Metadata could describe the trigger and effect
    },
    "Brave": {
        name: "Brave",
        description: "You have advantage on saving throws against being frightened.",
        source: "Halfling Race",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being frightened",
        }
    },
    "HalflingNimbleness": {
        name: "Halfling Nimbleness",
        description: "You can move through the space of any creature that is of a size larger than yours.",
        source: "Halfling Race",
        // Passive movement modification
    },

    // Class Features (Examples)
    "FightingStyleArchery": {
        name: "Fighting Style: Archery",
        description: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
        source: "Fighter Class",
        // Metadata could represent this bonus, potentially under specific conditions
    },
    "SecondWind": {
        name: "Second Wind",
        description: "On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter Class",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'short-rest',
        // Effect is healing, handled by action logic
    },
    "ActionSurge": {
        name: "Action Surge",
        description: "On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter Class",
        isActionable: true,
        maxUses: 1, // Varies by level
        usesResetOn: 'short-rest',
        // Effect grants an action, handled by combat logic
    },
    "SneakAttack": {
        name: "Sneak Attack",
        description: "Once per turn, you can deal extra damage (scales with level) to one creature you hit with an attack under certain conditions.",
        source: "Rogue Class",
        // Passive damage modification
    },
     "UnarmoredDefenseBarbarian": {
        name: 'Unarmored Defense (Barbarian)',
        description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
        source: 'Barbarian Class',
        metadata: {
            effectType: 'acBonus', // Or a specific 'unarmoredDefense' type
            value: 0, // Base AC is calculated dynamically
            condition: 'not wearing armor',
        },
    },
     "UnarmoredDefenseMonk": {
        name: 'Unarmored Defense (Monk)',
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        source: 'Monk Class',
         metadata: {
            effectType: 'acBonus', // Or a specific 'unarmoredDefense' type
            value: 0, // Base AC is calculated dynamically
            condition: 'not wearing armor and not wielding a shield',
        },
    },

    // Background Features (Example)
    "ShelterOfTheFaithful": {
        name: "Shelter of the Faithful",
        description: "As an acolyte, you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity...",
        source: "Acolyte Background",
        // Primarily narrative/social effect
    },
    "CitySecrets": {
        name: "City Secrets",
        description: "You know the secret patterns and flow to cities and can find passages through the urban sprawl that others would miss...",
        source: "Urchin Background",
        // Narrative/exploration effect
    },
};

// --- Service Functions ---

/**
 * Fetches the full definition of a feature by its name (or key).
 * In a real app, this would fetch from a database or API.
 * @param featureKey - The unique key/name of the feature.
 * @returns The Feature object or null if not found.
 */
export async function getFeatureDefinition(featureKey: string): Promise<Feature | null> {
    console.log(`getFeatureDefinition: Fetching definition for "${featureKey}" (using placeholders)`);
    // Simulate API/DB call
    await new Promise(resolve => setTimeout(resolve, 20));
    return FEATURE_DEFINITIONS[featureKey] || null;
}

/**
 * Fetches definitions for multiple features.
 * @param featureKeys - An array of feature keys/names.
 * @returns A promise resolving to an array of found Feature objects.
 */
export async function getMultipleFeatureDefinitions(featureKeys: string[]): Promise<Feature[]> {
    console.log(`getMultipleFeatureDefinitions: Fetching ${featureKeys.length} features (using placeholders)`);
    // Simulate fetching multiple items (potentially optimized)
    const definitions = await Promise.all(featureKeys.map(getFeatureDefinition));
    return definitions.filter((feature): feature is Feature => feature !== null);
}

/**
 * Retrieves features granted by a specific race name.
 * This is a placeholder/example; a real implementation needs structured race data.
 * @param raceName - The name of the race.
 * @returns A promise resolving to an array of Feature objects for the race.
 */
export async function getRaceFeatures(raceName: string): Promise<Feature[]> {
    console.log(`getRaceFeatures: Fetching features for race "${raceName}" (using placeholders)`);
    let featureKeys: string[] = [];
    switch (raceName) {
        case 'Human':
            featureKeys = ['HumanASI', 'ExtraLanguage'];
            break;
        case 'Elf':
            featureKeys = ['Darkvision', 'FeyAncestry', 'Trance'];
            // Add subrace features here based on selection if applicable
            break;
        case 'Dwarf':
            featureKeys = ['Darkvision', 'DwarvenResilience', 'Stonecunning'];
            // Add subrace features
            break;
        case 'Halfling':
            featureKeys = ['Lucky', 'Brave', 'HalflingNimbleness'];
            // Add subrace features
            break;
        // Add other races
    }
    return getMultipleFeatureDefinitions(featureKeys);
}

/**
 * Retrieves features granted by a specific class up to a given level.
 * This is a placeholder/example.
 * @param className - The name of the class.
 * @param level - The character's level in that class.
 * @returns A promise resolving to an array of Feature objects for the class/level.
 */
export async function getClassFeatures(className: string, level: number): Promise<Feature[]> {
    console.log(`getClassFeatures: Fetching features for ${className} level ${level} (using placeholders)`);
    let featureKeys: string[] = [];
    switch (className) {
        case 'Fighter':
            if (level >= 1) featureKeys.push('FightingStyleArchery', 'SecondWind'); // Example style
            if (level >= 2) featureKeys.push('ActionSurge');
            // Add keys for other levels/archetypes
            break;
        case 'Rogue':
             if (level >= 1) featureKeys.push('Expertise', 'SneakAttack', 'ThievesCant');
             if (level >= 2) featureKeys.push('CunningAction');
            // Add keys for other levels/archetypes
            break;
        // Add other classes
         case 'Barbarian':
            if (level >= 1) featureKeys.push('UnarmoredDefenseBarbarian' /*, 'Rage'*/);
            break;
        case 'Monk':
             if (level >= 1) featureKeys.push('UnarmoredDefenseMonk' /*, 'Martial Arts'*/);
            break;
    }
    return getMultipleFeatureDefinitions(featureKeys);
}

/**
 * Retrieves features granted by a specific background name.
 * This is a placeholder/example.
 * @param backgroundName - The name of the background.
 * @returns A promise resolving to an array of Feature objects for the background.
 */
export async function getBackgroundFeatures(backgroundName: string): Promise<Feature[]> {
     console.log(`getBackgroundFeatures: Fetching features for background "${backgroundName}" (using placeholders)`);
    let featureKeys: string[] = [];
     let proficiencyMetadata: FeatureEffectMetadata | undefined;

     switch (backgroundName) {
        case 'Acolyte':
            featureKeys = ['ShelterOfTheFaithful'];
             proficiencyMetadata = {
                effectType: 'proficiencyGrant',
                type: 'skill',
                proficiencies: ['Insight', 'Religion'],
            };
            break;
        case 'Urchin':
            featureKeys = ['CitySecrets'];
             proficiencyMetadata = { // Granting multiple types requires multiple metadata entries or a combined type
                 effectType: 'proficiencyGrant',
                 type: 'skill',
                 proficiencies: ['Sleight of Hand', 'Stealth'],
             };
             // Need another feature entry or modified metadata for tool proficiency
              const toolProfFeature: Feature = {
                 name: "Urchin Tool Proficiencies",
                 description: "You are proficient with the Disguise kit and Thieves' tools.",
                 source: "Urchin Background",
                 metadata: {
                     effectType: 'proficiencyGrant',
                     type: 'tool',
                     proficiencies: ["Disguise kit", "Thieves' tools"],
                 }
             };
             const baseFeatures = await getMultipleFeatureDefinitions(featureKeys);
             return [...baseFeatures, toolProfFeature]; // Return immediately for this case

        // Add other backgrounds
    }

     const features = await getMultipleFeatureDefinitions(featureKeys);
     // Add proficiency feature if defined
     if (proficiencyMetadata) {
         features.push({
             name: `${backgroundName} Skill Proficiencies`,
             description: `You gain proficiency in the ${proficiencyMetadata.proficiencies.join(' and ')} skills.`,
             source: `${backgroundName} Background`,
             metadata: proficiencyMetadata,
         });
     }

     return features;
}

// --- Helper Functions ---

// (Optional: Add functions here to help parse metadata or apply effects if needed server-side)
