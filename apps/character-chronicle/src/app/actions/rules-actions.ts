'use server';

/**
 * @fileOverview Server Actions for accessing game rule calculations.
 * These actions bridge the Next.js frontend with the NestJS RulesService.
 */

import type { Character, EquipmentItem, Feature, Monster, NPC } from '@/lib/types'; // Use frontend alias
import { AppContainer } from '@/nestjs/app-container';
import { RulesService } from '@/nestjs/rules/rules.service';
import { logMessage, logError } from '@/services/logging-service'; // Use frontend logging service alias

// Helper function to get the RulesService instance
const getRulesService = async (): Promise<RulesService> => {
  const container = await AppContainer.getInstance();
  return container.get(RulesService);
};

// --- Rule Calculation Actions ---

export async function calculateAbilityModifierAction(score: number | undefined | null): Promise<{ success: boolean; modifier: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const modifier = await rulesService.calculateAbilityModifier(score);
    return { success: true, modifier };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating ability modifier', score });
    return { success: false, modifier: 0, error: error instanceof Error ? error.message : 'Failed to calculate ability modifier.' };
  }
}

export async function calculateSkillModifierAction(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined,
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[]
): Promise<{ success: boolean; modifier: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const modifier = await rulesService.calculateSkillModifier(skillName, stats, proficient, proficiencyBonus, expertiseFeatures);
    return { success: true, modifier };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating skill modifier', skillName, proficient, proficiencyBonus });
    return { success: false, modifier: 0, error: error instanceof Error ? error.message : 'Failed to calculate skill modifier.' };
  }
}

export async function calculateArmorClassAction(character: Character): Promise<{ success: boolean; ac: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const ac = await rulesService.calculateArmorClass(character);
    return { success: true, ac };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating Armor Class', characterId: character.id });
    return { success: false, ac: 10, error: error instanceof Error ? error.message : 'Failed to calculate Armor Class.' };
  }
}

export async function calculateHitBonusAction(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<{ success: boolean; bonus: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const bonus = await rulesService.calculateHitBonus(weapon, character, proficiencyBonus);
    return { success: true, bonus };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating hit bonus', weaponName: weapon.name, characterId: character.id });
    return { success: false, bonus: 0, error: error instanceof Error ? error.message : 'Failed to calculate hit bonus.' };
  }
}

export async function calculateDamageBonusAction(weapon: EquipmentItem, character: Character): Promise<{ success: boolean; bonus: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const bonus = await rulesService.calculateDamageBonus(weapon, character);
    return { success: true, bonus };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating damage bonus', weaponName: weapon.name, characterId: character.id });
    return { success: false, bonus: 0, error: error instanceof Error ? error.message : 'Failed to calculate damage bonus.' };
  }
}

export async function calculateSpellSaveDCAction(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<{ success: boolean; dc: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const dc = await rulesService.calculateSpellSaveDC(proficiencyBonus, spellcastingAbilityScore);
    return { success: true, dc };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating spell save DC', proficiencyBonus, spellcastingAbilityScore });
    return { success: false, dc: 8, error: error instanceof Error ? error.message : 'Failed to calculate spell save DC.' };
  }
}

export async function calculateSpellAttackBonusAction(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<{ success: boolean; bonus: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    const bonus = await rulesService.calculateSpellAttackBonus(proficiencyBonus, spellcastingAbilityScore);
    return { success: true, bonus };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating spell attack bonus', proficiencyBonus, spellcastingAbilityScore });
    return { success: false, bonus: 0, error: error instanceof Error ? error.message : 'Failed to calculate spell attack bonus.' };
  }
}

export async function calculateMaxHitPointsAction(level: number, conScore: number, classHitDie: `d${6 | 8 | 10 | 12}` | null): Promise<{ success: boolean; maxHp: number; error?: string }> {
  try {
    const rulesService = await getRulesService();
    // Pass conScore directly, service will calculate modifier
    const maxHp = await rulesService.calculateMaxHitPoints(level, conScore, classHitDie);
    return { success: true, maxHp };
  } catch (error) {
    logError(error, { message: '[Action] Error calculating max hit points', level, conScore, classHitDie });
    return { success: false, maxHp: 1, error: error instanceof Error ? error.message : 'Failed to calculate max hit points.' };
  }
}

    