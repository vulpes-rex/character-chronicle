'use server';

import type { Character, EquipmentItem, Feature, FeatureEffectMetadata, Monster, NPC } from '@/lib/types';
import { SKILL_ABILITY_MAP } from '@/lib/types';
import { logMessage } from './logging-service';

/**
 * Calculates the modifier for a given ability score.
 * @param score - The ability score value.
 * @returns The calculated modifier.
 */
export async function calculateAbilityModifier(score: number | undefined | null): Promise<number> {
    if (score === null || score === undefined) return 0;
    return Math.floor((score - 10) / 2);
}

/**
 * Calculates the modifier for a given skill.
 * Considers base ability score, proficiency bonus if applicable, and potential expertises (not yet implemented).
 *
 * @param skillName - The name of the skill (e.g., "athletics").
 * @param stats - The character's final derived ability scores (STR, DEX, etc.).
 * @param proficient - Whether the character is proficient in the skill.
 * @param proficiencyBonus - The character's proficiency bonus.
 * @param expertiseFeatures - Optional array of features to check for Expertise.
 * @returns The calculated skill modifier.
 */
export async function calculateSkillModifier(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined, // Use base stats
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[] // Optional: Pass features that grant expertise
): Promise<number> {
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

    const abilityModifier = calculateAbilityModifier(stats[ability]);
    let proficiencyValue = proficient ? proficiencyBonus : 0;

    // TODO: Add check for expertise (would double proficiencyValue)
    // if (proficient && expertiseFeatures) { ... }

    return abilityModifier + proficiencyValue;
}

/**
 * Calculates a character's Armor Class (AC).
 * Considers equipped armor, shield, Dexterity modifier, and relevant features (like Unarmored Defense, AC bonuses).
 *
 * @param character - The character object, containing final stats, equipment, and features.
 * @returns The calculated Armor Class.
 */
export async function calculateArmorClass(character: Character): Promise<number> {
    const dexMod = calculateAbilityModifier(character.stats.dexterity);
    let baseAC = 10; // Default unarmored AC
    let calculatedAC = 0;
    let armorDexMod = dexMod; // Assume full Dex bonus initially
    let maxDex: number | null = null;
    let hasShield = false;
    let armorEquipped = false;
    let unarmoredDefenseValue: number | null = null;

    // 1. Check for Unarmored Defense features FIRST
    character.features.forEach(f => {
        const metadata = f.metadata as FeatureEffectMetadata | undefined;
        if (metadata?.effectType === 'acCalculation') {
            // Conditions are checked later based on equipped items
            if (metadata.formula === '10 + dexMod + conMod') {
                unarmoredDefenseValue = 10 + dexMod + calculateAbilityModifier(character.stats.constitution);
            } else if (metadata.formula === '10 + dexMod + wisMod') {
                unarmoredDefenseValue = 10 + dexMod + calculateAbilityModifier(character.stats.wisdom);
            }
        }
    });

    // 2. Process Equipped Armor & Shield
    character.equipment
        .filter(item => item.isEquipped && item.type === 'Armor')
        .forEach(item => {
            if (item.armorCategory === 'Shield') {
                hasShield = true;
            } else if (!armorEquipped && item.baseAC !== undefined) { // Apply only the first equipped body armor
                baseAC = item.baseAC; // Set base AC from armor
                if (item.addDexModifier === false) armorDexMod = 0; // Determine if Dex applies
                maxDex = item.maxDexBonus ?? null; // Check max Dex bonus
                armorEquipped = true; // Mark that armor is equipped
            }
        });

    // 3. Determine Base AC and Applicable Dex Mod based on Armor/Unarmored Defense
    if (unarmoredDefenseValue !== null) {
        // Apply Unarmored Defense ONLY if no armor is worn (Shields are allowed by Barbarian, not Monk)
        const canUseUnarmored =
            (character.features.some(f => f.name === 'Unarmored Defense (Barbarian)') && !armorEquipped) || // Barbarian: No armor, Shield OK
            (character.features.some(f => f.name === 'Unarmored Defense (Monk)') && !armorEquipped && !hasShield); // Monk: No armor, No shield

        if (canUseUnarmored) {
            calculatedAC = unarmoredDefenseValue;
            armorDexMod = 0; // Dex/Con/Wis already included in the formula
        } else {
            // Unarmored Defense feature exists but conditions not met (armor worn/shield for Monk)
            // Fall back to normal calculation based on armor (or lack thereof)
            calculatedAC = baseAC; // Use baseAC from equipped armor or default 10 if none
        }
    } else {
        // No Unarmored Defense feature
        calculatedAC = baseAC; // Use baseAC from equipped armor or default 10 if none
    }

    // Apply Dexterity modifier (potentially capped)
    if (maxDex !== null) armorDexMod = Math.min(armorDexMod, maxDex);
    calculatedAC += armorDexMod;

    // Add shield bonus
    if (hasShield) calculatedAC += 2; // Standard shield bonus

    // 4. Add other AC bonuses from features (like Defense Fighting Style)
    character.features.forEach(feature => {
        const metadata = feature.metadata as FeatureEffectMetadata | undefined;
        if (metadata?.effectType === 'acBonus') {
            // Check condition if it exists
            const conditionMet = !metadata.condition ||
                (metadata.condition === 'wearing armor' && armorEquipped) ||
                (metadata.condition === 'not wearing heavy armor' && !character.equipment.some(i => i.isEquipped && i.armorCategory === 'Heavy')); // Example condition
            // Add more condition checks as needed

            if (conditionMet && metadata.value) {
                calculatedAC += metadata.value;
            }
        }
    });

    logMessage('debug', `Calculated AC for ${character.id}: ${calculatedAC}`);
    return calculatedAC;
}

/**
 * Calculates the "to hit" bonus for a given weapon attack.
 * Considers relevant ability score (Strength or Dexterity for Finesse), proficiency bonus, and other modifiers.
 *
 * @param weapon - The weapon item being used.
 * @param character - The character making the attack.
 * @param proficiencyBonus - The character's proficiency bonus.
 * @returns The calculated "to hit" bonus.
 */
export async function calculateHitBonus(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<number> {
    const isProficient = character.proficiencies?.weapons?.includes(weapon.weaponCategory || '') ||
                         character.proficiencies?.weapons?.includes(weapon.name); // Check specific weapon or category

    let abilityMod = 0;
    const strMod = calculateAbilityModifier(character.stats.strength);
    const dexMod = calculateAbilityModifier(character.stats.dexterity);

    // Determine which ability modifier to use
    if (weapon.properties?.includes('Finesse')) {
        abilityMod = Math.max(strMod, dexMod); // Use higher of STR or DEX for Finesse
    } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
        abilityMod = dexMod; // Ranged weapons typically use DEX
    } else {
        abilityMod = strMod; // Melee weapons typically use STR
    }

    let bonus = abilityMod;
    if (isProficient) {
        bonus += proficiencyBonus;
    }

    // Add other potential bonuses (e.g., from Fighting Style: Archery)
    character.features.forEach(feature => {
        const metadata = feature.metadata as FeatureEffectMetadata | undefined;
        // Example: Archery Fighting Style
        if (feature.name === 'Fighting Style: Archery' && metadata?.effectType === 'attackBonus' && weapon.weaponCategory?.toLowerCase().includes('ranged')) {
            bonus += metadata.value || 0;
        }
        // Add checks for other relevant features
    });


    return bonus;
}

/**
 * Calculates the damage bonus for a given weapon attack.
 * Considers relevant ability score (Strength or Dexterity for Finesse).
 *
 * @param weapon - The weapon item being used.
 * @param character - The character making the attack.
 * @returns The calculated damage bonus.
 */
export async function calculateDamageBonus(weapon: EquipmentItem, character: Character): Promise<number> {
    let abilityMod = 0;
    const strMod = calculateAbilityModifier(character.stats.strength);
    const dexMod = calculateAbilityModifier(character.stats.dexterity);

    // Determine which ability modifier to use for damage
    if (weapon.properties?.includes('Finesse')) {
        abilityMod = Math.max(strMod, dexMod); // Finesse allows using higher of STR or DEX for damage too
    } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
        abilityMod = dexMod; // Ranged uses DEX
    } else {
        abilityMod = strMod; // Melee uses STR
    }

    // Add other potential bonuses (e.g., from Fighting Style: Dueling)
    for (const feature of character.features) {
        const metadata = feature.metadata as FeatureEffectMetadata | undefined;
        // Example: Dueling Fighting Style (needs condition check)
        if (feature.name === 'Fighting Style: Dueling' && metadata?.effectType === 'damageBonus') {
            // Simple check: assumes condition met. Real check needs info on off-hand.
            // const isWieldingOneHanded = !character.equipment.some(i => i.isEquipped && i.type === 'Weapon' && i.name !== weapon.name); // Basic check
            // if (isWieldingOneHanded) {
            //     bonus += metadata.value || 0;
            // }
            // Simplified for now: Add logic to check off-hand weapon later
            abilityMod += metadata.value || 0; // Placeholder addition
        }
        // Add checks for other relevant features like Rage damage
    }

    return abilityMod;
}

/**
 * Calculates spell save DC.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier.
 *
 * @param proficiencyBonus - The character's proficiency bonus.
 * @param spellcastingAbilityScore - The score of the character's spellcasting ability.
 * @returns The calculated Spell Save DC.
 */
export async function calculateSpellSaveDC(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = calculateAbilityModifier(spellcastingAbilityScore);
    return 8 + proficiencyBonus + abilityModifier;
}

/**
 * Calculates spell attack bonus.
 * Formula: Proficiency Bonus + Spellcasting Ability Modifier.
 *
 * @param proficiencyBonus - The character's proficiency bonus.
 * @param spellcastingAbilityScore - The score of the character's spellcasting ability.
 * @returns The calculated Spell Attack Bonus.
 */
export async function calculateSpellAttackBonus(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = calculateAbilityModifier(spellcastingAbilityScore);
    return proficiencyBonus + abilityModifier;
}

/**
 * Calculates maximum Hit Points for a character.
 * Uses class hit die, level, and constitution modifier.
 * Assumes average HP gain for levels after 1st.
 *
 * @param level - The character's total level.
 * @param conModifier - The character's constitution modifier.
 * @param classHitDie - The hit die type of the character's primary class (e.g., 'd8').
 * @returns The calculated maximum Hit Points.
 */
export async function calculateMaxHitPoints(level: number, conModifier: number, classHitDie: `d${6 | 8 | 10 | 12}` | null): Promise<number> {
    if (!classHitDie || level < 1) {
        return 0; // Cannot calculate without hit die or level
    }

    const hitDieSides = parseInt(classHitDie.substring(1), 10);
    if (isNaN(hitDieSides)) return 0;

    // Level 1 HP
    let maxHp = hitDieSides + conModifier;

    // Add HP for subsequent levels (using average rounded up)
    if (level > 1) {
        const averageHpPerLevel = Math.ceil((hitDieSides + 1) / 2);
        maxHp += (level - 1) * (averageHpPerLevel + conModifier);
    }

    return Math.max(1, maxHp); // Minimum 1 HP
}
