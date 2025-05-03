
'use server';

import type { Character, EquipmentItem, Feature, Monster, NPC } from '@/lib/types';
import { AppContainer } from '@/nestjs/app-container';
import { RulesService as NestRulesService } from '@/nestjs/rules/rules.service';
import { logMessage, logError } from '@/services/logging-service';

const getRulesService = async (): Promise<NestRulesService> => {
  const container = await AppContainer.getInstance();
  return container.get(NestRulesService);
};

// --- Server Actions ---

/** Calculates the modifier for a given ability score. */
export async function calculateAbilityModifier(score: number | undefined | null): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateAbilityModifier(score);
  } catch (error) {
    logError(error, { message: 'Error calculating ability modifier', score });
    return 0; // Return default on error
  }
}

/** Calculates the modifier for a given skill. */
export async function calculateSkillModifier(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined,
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[]
): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateSkillModifier(skillName, stats, proficient, proficiencyBonus, expertiseFeatures);
  } catch (error) {
    logError(error, { message: 'Error calculating skill modifier', skillName, proficient, proficiencyBonus });
    return 0; // Return default on error
  }
}

/** Calculates a character's Armor Class (AC). */
export async function calculateArmorClass(character: Character): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateArmorClass(character);
  } catch (error) {
    logError(error, { message: 'Error calculating Armor Class', characterId: character.id });
    return 10; // Return default on error
  }
}

/** Calculates the "to hit" bonus for a given weapon attack. */
export async function calculateHitBonus(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateHitBonus(weapon, character, proficiencyBonus);
  } catch (error) {
    logError(error, { message: 'Error calculating hit bonus', weaponName: weapon.name, characterId: character.id });
    return 0; // Return default on error
  }
}

/** Calculates the damage bonus for a given weapon attack. */
export async function calculateDamageBonus(weapon: EquipmentItem, character: Character): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateDamageBonus(weapon, character);
  } catch (error) {
    logError(error, { message: 'Error calculating damage bonus', weaponName: weapon.name, characterId: character.id });
    return 0; // Return default on error
  }
}

/** Calculates spell save DC. */
export async function calculateSpellSaveDC(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateSpellSaveDC(proficiencyBonus, spellcastingAbilityScore);
  } catch (error) {
    logError(error, { message: 'Error calculating spell save DC', proficiencyBonus, spellcastingAbilityScore });
    return 8; // Return default on error
  }
}

/** Calculates spell attack bonus. */
export async function calculateSpellAttackBonus(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
  try {
    const service = await getRulesService();
    return await service.calculateSpellAttackBonus(proficiencyBonus, spellcastingAbilityScore);
  } catch (error) {
    logError(error, { message: 'Error calculating spell attack bonus', proficiencyBonus, spellcastingAbilityScore });
    return 0; // Return default on error
  }
}

/** Calculates maximum Hit Points for a character. */
export async function calculateMaxHitPoints(level: number, conScore: number, classHitDie: `d${6 | 8 | 10 | 12}` | null): Promise<number> {
  try {
    const service = await getRulesService();
    // The service method now expects the score, not the modifier
    return await service.calculateMaxHitPoints(level, conScore, classHitDie);
  } catch (error) {
    logError(error, { message: 'Error calculating max hit points', level, conScore, classHitDie });
    return 1; // Return default on error
  }
}
