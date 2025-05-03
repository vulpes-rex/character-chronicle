
'use server';

import type { Character, EquipmentItem, Feature, FeatureEffectMetadata, Monster, NPC } from '@/lib/types';
import { SKILL_ABILITY_MAP } from '@/lib/types';
import { logMessage, logError } from './logging-service';
import { Engine, Rule } from 'json-rules-engine';

// --- Helper function to calculate ability modifier (used within rules) ---
function calculateMod(score: number | undefined | null): number {
    if (score === null || score === undefined) return 0;
    return Math.floor((score - 10) / 2);
}

// --- json-rules-engine Rules Definitions ---

const abilityModifierRule = new Rule({
    conditions: { all: [{ fact: 'score', operator: 'greaterThanInclusive', value: 1 }] },
    event: {
        type: 'calculate-modifier',
        params: {
            modifier: 0, // Placeholder, calculated dynamically
        },
    },
    onSuccess: async (event, almanac) => {
        const score = await almanac.factValue('score');
        event.params!.modifier = calculateMod(score);
    },
});

const skillModifierRule = new Rule({
    conditions: { all: [{ fact: 'abilityScore', operator: 'greaterThanInclusive', value: 1 }] },
    event: {
        type: 'calculate-skill-modifier',
        params: {
            modifier: 0, // Placeholder
        },
    },
     onSuccess: async (event, almanac) => {
        const abilityScore = await almanac.factValue('abilityScore');
        const isProficient = await almanac.factValue('isProficient');
        const proficiencyBonus = await almanac.factValue('proficiencyBonus');
        const baseModifier = calculateMod(abilityScore);
        // TODO: Incorporate expertise check if needed
        const profValue = isProficient ? proficiencyBonus : 0;
        event.params!.modifier = baseModifier + profValue;
    },
});

// AC Rule (Simplified Example - Add more rules for armor, shields, features)
const baseACRule = new Rule({
    conditions: { all: [{ fact: 'isWearingArmor', operator: 'equal', value: false }] },
    event: { type: 'set-base-ac', params: { ac: 10 } },
});
const dexToACRule = new Rule({
    conditions: { all: [{ fact: 'applyDexToAC', operator: 'equal', value: true }] },
    event: { type: 'add-dex-to-ac' },
});
const shieldBonusRule = new Rule({
    conditions: { all: [{ fact: 'hasShield', operator: 'equal', value: true }] },
    event: { type: 'add-shield-bonus', params: { bonus: 2 } },
});
// Add rules for specific armor types, max dex bonus, unarmored defense, feature bonuses...

// --- Service Functions using json-rules-engine ---

/**
 * Calculates the modifier for a given ability score.
 * @param score - The ability score value.
 * @returns The calculated modifier.
 */
export async function calculateAbilityModifier(score: number | undefined | null): Promise<number> {
    if (score === null || score === undefined) return 0;
    const engine = new Engine([abilityModifierRule]);
    try {
        const { events } = await engine.run({ score: score });
        return events.length > 0 ? events[0].params?.modifier || 0 : 0;
    } catch (error) {
        logError(error as Error, { function: 'calculateAbilityModifier', score });
        return 0; // Fallback on error
    }
}

/**
 * Calculates the modifier for a given skill.
 * Considers base ability score, proficiency bonus if applicable.
 * Expertise requires more complex rules/facts not fully implemented here.
 */
export async function calculateSkillModifier(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined,
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[]
): Promise<number> {
    const skillLower = skillName.toLowerCase();
    const ability = SKILL_ABILITY_MAP[skillLower];

    if (!stats) {
        logMessage('warn', `Stats object is missing for skill calculation: ${skillName}.`);
        return 0;
    }

    // Handle direct skill modifiers from monsters/NPCs
    if ('skills' in stats && stats.skills && typeof stats.skills[skillLower] === 'number') {
        return stats.skills[skillLower] as number;
    }

    if (!ability || typeof stats[ability] !== 'number') {
        if (!ability) logMessage('warn', `Could not find ability mapping for skill: ${skillName}.`);
        return 0;
    }

    const engine = new Engine([skillModifierRule]);
    const facts = {
        abilityScore: stats[ability]!,
        isProficient: proficient,
        proficiencyBonus: proficiencyBonus,
        // TODO: Add expertise facts/rules
    };

    try {
        const { events } = await engine.run(facts);
        return events.length > 0 ? events[0].params?.modifier || 0 : 0;
    } catch (error) {
        logError(error as Error, { function: 'calculateSkillModifier', skillName, facts });
        return 0; // Fallback
    }
}

/**
 * Calculates a character's Armor Class (AC).
 * This implementation is a placeholder and needs to be expanded with proper rules
 * for armor types, shields, Dex modifiers (with caps), and AC-affecting features.
 *
 * @param character - The character object.
 * @returns The calculated Armor Class.
 */
export async function calculateArmorClass(character: Character): Promise<number> {
    // TODO: Implement comprehensive AC calculation using json-rules-engine
    // This involves defining rules for:
    // 1. Base AC (10)
    // 2. Specific Armor Base AC + Dex application (and max dex)
    // 3. Shield bonus
    // 4. Unarmored Defense features (conditional)
    // 5. Other AC bonus features (conditional)

    // Placeholder logic:
    let ac = 10; // Default base
    const dexMod = await calculateAbilityModifier(character.stats.dexterity);
    ac += dexMod; // Add basic Dex

    const equippedArmor = character.equipment.find(i => i.isEquipped && i.type === 'Armor' && i.armorCategory !== 'Shield');
    const equippedShield = character.equipment.find(i => i.isEquipped && i.armorCategory === 'Shield');

    if (equippedArmor) {
        ac = equippedArmor.baseAC || 10;
        let armorDexMod = dexMod;
        if(equippedArmor.addDexModifier === false) armorDexMod = 0;
        if(equippedArmor.maxDexBonus !== null && equippedArmor.maxDexBonus !== undefined) {
            armorDexMod = Math.min(armorDexMod, equippedArmor.maxDexBonus);
        }
        ac += armorDexMod;
    }
    if(equippedShield) {
        ac += 2; // Standard shield AC
    }

    // Apply simple AC bonuses (needs refinement for conditions)
    character.features.forEach(feature => {
        const metadata = feature.metadata;
        if (metadata?.effectType === 'acBonus') {
             ac += metadata.value || 0;
        }
        // Add logic for Unarmored Defense, etc.
    });


    logMessage('debug', `Calculated AC (placeholder) for ${character.id}: ${ac}`);
    return ac; // Return simplified AC for now
}

/**
 * Calculates the "to hit" bonus for a given weapon attack.
 * Uses json-rules-engine for applying modifiers.
 */
export async function calculateHitBonus(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<number> {
    const isProficient = character.proficiencies?.weapons?.includes(weapon.weaponCategory || '') ||
                         character.proficiencies?.weapons?.includes(weapon.name);

    const strMod = await calculateAbilityModifier(character.stats.strength);
    const dexMod = await calculateAbilityModifier(character.stats.dexterity);

    let baseAbilityMod = strMod; // Default to STR
    if (weapon.properties?.includes('Finesse')) {
        baseAbilityMod = Math.max(strMod, dexMod);
    } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
        baseAbilityMod = dexMod;
    }

    // Define facts for the rules engine
    const facts = {
        baseAbilityModifier: baseAbilityMod,
        isProficient: isProficient,
        proficiencyBonus: proficiencyBonus,
        isRangedWeapon: weapon.weaponCategory?.toLowerCase().includes('ranged') ?? false,
        features: character.features.map(f => f.name), // Pass feature names
        // Add more facts as needed for complex rules
    };

    // Define rules for hit bonus
    const hitBonusRule = new Rule({
        conditions: { all: [] }, // Always run
        event: { type: 'calculate-hit-bonus', params: { bonus: 0 } },
        onSuccess: async (event, almanac) => {
            const baseMod = await almanac.factValue('baseAbilityModifier');
            const profBonus = await almanac.factValue('isProficient') ? await almanac.factValue('proficiencyBonus') : 0;
            event.params!.bonus = baseMod + profBonus;
        }
    });

    const archeryStyleRule = new Rule({
        conditions: {
            all: [
                { fact: 'features', operator: 'contains', value: 'Fighting Style: Archery' },
                { fact: 'isRangedWeapon', operator: 'equal', value: true }
            ]
        },
        event: { type: 'apply-archery-bonus', params: { bonus: 2 } },
        onSuccess: async (event, almanac) => {
             // The bonus is applied additively in the final calculation
        }
    });

    const engine = new Engine([hitBonusRule, archeryStyleRule]);

    try {
        const { events } = await engine.run(facts);
        let totalBonus = 0;
        events.forEach(event => {
             if (event.params?.bonus) {
                 totalBonus += event.params.bonus;
             }
         });
        logMessage('debug', `Calculated hit bonus for ${character.id} with ${weapon.name}: ${totalBonus}`);
        return totalBonus;
    } catch (error) {
        logError(error as Error, { function: 'calculateHitBonus', weapon, characterId: character.id });
        return 0; // Fallback
    }
}

/**
 * Calculates the damage bonus for a given weapon attack.
 * Uses json-rules-engine for applying modifiers.
 */
export async function calculateDamageBonus(weapon: EquipmentItem, character: Character): Promise<number> {
    const strMod = await calculateAbilityModifier(character.stats.strength);
    const dexMod = await calculateAbilityModifier(character.stats.dexterity);

    let baseAbilityMod = strMod; // Default to STR
    if (weapon.properties?.includes('Finesse')) {
        baseAbilityMod = Math.max(strMod, dexMod);
    } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
        baseAbilityMod = dexMod;
    }

    // Define facts
    const facts = {
        baseAbilityModifier: baseAbilityMod,
        features: character.features.map(f => f.name),
        isWieldingOneHandedMelee: true, // Placeholder - needs actual check based on equipment state
    };

    // Define rules
    const damageBonusRule = new Rule({
        conditions: { all: [] }, // Always apply base ability mod
        event: { type: 'calculate-damage-bonus', params: { bonus: 0 } },
        onSuccess: async (event, almanac) => {
             event.params!.bonus = await almanac.factValue('baseAbilityModifier');
        }
    });

    const duelingStyleRule = new Rule({
        conditions: {
            all: [
                { fact: 'features', operator: 'contains', value: 'Fighting Style: Dueling' },
                { fact: 'isWieldingOneHandedMelee', operator: 'equal', value: true } // Condition check
            ]
        },
        event: { type: 'apply-dueling-bonus', params: { bonus: 2 } },
         onSuccess: async (event, almanac) => {
            // Bonus applied additively later
         }
    });

    // Add rules for Rage, etc.

    const engine = new Engine([damageBonusRule, duelingStyleRule /*, ...otherDamageRules*/]);

    try {
        const { events } = await engine.run(facts);
        let totalBonus = 0;
        events.forEach(event => {
             if (event.params?.bonus) {
                 totalBonus += event.params.bonus;
             }
         });
        logMessage('debug', `Calculated damage bonus for ${character.id} with ${weapon.name}: ${totalBonus}`);
        return totalBonus;
    } catch (error) {
        logError(error as Error, { function: 'calculateDamageBonus', weapon, characterId: character.id });
        return 0; // Fallback
    }
}


/**
 * Calculates spell save DC.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier.
 */
export async function calculateSpellSaveDC(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = await calculateAbilityModifier(spellcastingAbilityScore);
    return 8 + proficiencyBonus + abilityModifier;
}

/**
 * Calculates spell attack bonus.
 * Formula: Proficiency Bonus + Spellcasting Ability Modifier.
 */
export async function calculateSpellAttackBonus(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = await calculateAbilityModifier(spellcastingAbilityScore);
    return proficiencyBonus + abilityModifier;
}

/**
 * Calculates maximum Hit Points for a character.
 * Uses class hit die, level, and constitution modifier.
 * Assumes average HP gain for levels after 1st.
 */
export async function calculateMaxHitPoints(level: number, conScore: number, classHitDie: `d${6 | 8 | 10 | 12}` | null): Promise<number> {
    if (!classHitDie || level < 1) {
        return 0;
    }
    const conModifier = await calculateAbilityModifier(conScore);
    const hitDieSides = parseInt(classHitDie.substring(1), 10);
    if (isNaN(hitDieSides)) return 0;

    let maxHp = hitDieSides + conModifier; // Level 1
    if (level > 1) {
        const averageHpPerLevel = Math.ceil((hitDieSides + 1) / 2);
        maxHp += (level - 1) * (averageHpPerLevel + conModifier);
    }
    return Math.max(1, maxHp); // Minimum 1 HP
}
