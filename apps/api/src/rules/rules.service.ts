
import { Injectable } from '@nestjs/common';
import { Engine, Rule } from 'json-rules-engine';
import type { Character, EquipmentItem, Feature, FeatureEffectMetadata, Monster, NPC } from '@character-chronicle/shared/types'; // Use shared library path
import { SKILL_ABILITY_MAP } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path

@Injectable()
export class RulesService {
  constructor(private readonly logger: LoggingService) {}

  // --- Helper function ---
  private async calculateMod(score: number | undefined | null): Promise<number> {
    if (score === null || score === undefined) return 0;
    return Math.floor((score - 10) / 2);
  }

  // --- json-rules-engine Rules Definitions ---

  // Define rules as properties or methods within the service
  private abilityModifierRule = new Rule({
    conditions: { all: [{ fact: 'score', operator: 'greaterThanInclusive', value: 1 }] },
    event: { type: 'calculate-modifier', params: { modifier: 0 } },
    onSuccess: async (event, almanac) => {
        const score = await almanac.factValue('score');
        event.params!.modifier = await this.calculateMod(score);
    },
  });

  private skillModifierRule = new Rule({
    conditions: { all: [{ fact: 'abilityScore', operator: 'greaterThanInclusive', value: 1 }] },
    event: { type: 'calculate-skill-modifier', params: { modifier: 0 } },
    onSuccess: async (event, almanac) => {
        const abilityScore = await almanac.factValue('abilityScore');
        const isProficient = await almanac.factValue('isProficient');
        const proficiencyBonus = await almanac.factValue('proficiencyBonus');
        const baseModifier = await this.calculateMod(abilityScore);
        const profValue = isProficient ? proficiencyBonus : 0;
        // TODO: Incorporate expertise check
        event.params!.modifier = baseModifier + profValue;
    },
  });

  // AC Rules (Simplified)
  private baseACRule = new Rule({
    conditions: { all: [{ fact: 'isWearingArmor', operator: 'equal', value: false }] },
    event: { type: 'set-base-ac', params: { ac: 10 } },
  });
  private dexToACRule = new Rule({
    conditions: { all: [{ fact: 'applyDexToAC', operator: 'equal', value: true }] },
    event: { type: 'add-dex-to-ac' },
  });
  private shieldBonusRule = new Rule({
    conditions: { all: [{ fact: 'hasShield', operator: 'equal', value: true }] },
    event: { type: 'add-shield-bonus', params: { bonus: 2 } },
  });
   // Add more AC rules here...

   // Hit Bonus Rules
    private hitBonusRule = new Rule({
        conditions: { all: [] },
        event: { type: 'calculate-hit-bonus', params: { bonus: 0 } },
        onSuccess: async (event, almanac) => {
            const baseMod = await almanac.factValue('baseAbilityModifier');
            const profBonus = await almanac.factValue('isProficient') ? await almanac.factValue('proficiencyBonus') : 0;
            event.params!.bonus = baseMod + profBonus;
        }
    });

    private archeryStyleRule = new Rule({
        conditions: {
            all: [
                { fact: 'features', operator: 'contains', value: 'Fighting Style: Archery' },
                { fact: 'isRangedWeapon', operator: 'equal', value: true }
            ]
        },
        event: { type: 'apply-archery-bonus', params: { bonus: 2 } },
    });

    // Damage Bonus Rules
    private damageBonusRule = new Rule({
        conditions: { all: [] },
        event: { type: 'calculate-damage-bonus', params: { bonus: 0 } },
        onSuccess: async (event, almanac) => {
             event.params!.bonus = await almanac.factValue('baseAbilityModifier');
        }
    });

     private duelingStyleRule = new Rule({
        conditions: {
            all: [
                { fact: 'features', operator: 'contains', value: 'Fighting Style: Dueling' },
                { fact: 'isWieldingOneHandedMelee', operator: 'equal', value: true } // Condition check
            ]
        },
        event: { type: 'apply-dueling-bonus', params: { bonus: 2 } },
    });


  // --- Service Methods ---

  /** Calculates the modifier for a given ability score. */
  async calculateAbilityModifier(score: number | undefined | null): Promise<number> {
    if (score === null || score === undefined) return 0;
    // Direct calculation is simpler and faster than rules engine for this
    return this.calculateMod(score);
    // const engine = new Engine([this.abilityModifierRule]);
    // try {
    //     const { events } = await engine.run({ score: score });
    //     return events.length > 0 ? events[0].params?.modifier || 0 : 0;
    // } catch (error) {
    //     this.logger.error('Error calculating ability modifier', error instanceof Error ? error.stack : undefined, 'RulesService', { score });
    //     return 0;
    // }
  }

  /** Calculates the modifier for a given skill. */
  async calculateSkillModifier(
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined,
    proficient: boolean,
    proficiencyBonus: number,
    expertiseFeatures?: Feature[]
  ): Promise<number> {
    const skillLower = skillName.toLowerCase();
    const ability = SKILL_ABILITY_MAP[skillLower];

    if (!stats) {
        this.logger.warn(`Stats object is missing for skill calculation: ${skillName}.`, 'RulesService');
        return 0;
    }
    if ('skills' in stats && stats.skills && typeof stats.skills[skillLower] === 'number') {
        return stats.skills[skillLower] as number;
    }
    if (!ability || typeof stats[ability] !== 'number') {
        if (!ability) this.logger.warn(`Could not find ability mapping for skill: ${skillName}.`, 'RulesService');
        return 0;
    }

    const engine = new Engine([this.skillModifierRule]);
    const facts = { abilityScore: stats[ability]!, isProficient: proficient, proficiencyBonus };

    try {
        const { events } = await engine.run(facts);
        return events.length > 0 ? events[0].params?.modifier || 0 : 0;
    } catch (error) {
        this.logger.error(`Error calculating skill modifier for ${skillName}`, error instanceof Error ? error.stack : undefined, 'RulesService', { facts });
        return 0;
    }
  }

  /** Calculates a character's Armor Class (AC). */
  async calculateArmorClass(character: Character): Promise<number> {
      this.logger.debug(`Calculating AC for character ${character.id}`, 'RulesService');
      const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);
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
                  unarmoredDefenseValue = 10 + dexMod + this.calculateMod(character.stats.constitution);
              } else if (metadata.formula === '10 + dexMod + wisMod') {
                  unarmoredDefenseValue = 10 + dexMod + this.calculateMod(character.stats.wisdom);
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

      this.logger.debug(`Calculated AC for ${character.id}: ${calculatedAC}`);
      return calculatedAC;
  }


  /** Calculates the "to hit" bonus for a given weapon attack. */
  async calculateHitBonus(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<number> {
    const isProficient = character.proficiencies?.weapons?.includes(weapon.weaponCategory || '') ||
                         character.proficiencies?.weapons?.includes(weapon.name); // Check specific weapon or category

    let abilityMod = 0;
    const strMod = await this.calculateAbilityModifier(character.stats.strength);
    const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);

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

  /** Calculates the damage bonus for a given weapon attack. */
  async calculateDamageBonus(weapon: EquipmentItem, character: Character): Promise<number> {
    let abilityMod = 0;
    const strMod = await this.calculateAbilityModifier(character.stats.strength);
    const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);

    // Determine which ability modifier to use for damage
    if (weapon.properties?.includes('Finesse')) {
        abilityMod = Math.max(strMod, dexMod); // Finesse allows using higher of STR or DEX for damage too
    } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
        abilityMod = dexMod; // Ranged uses DEX
    } else {
        abilityMod = strMod; // Melee uses STR
    }

    // Add other potential bonuses (e.g., from Fighting Style: Dueling)
     character.features.forEach(feature => {
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
     });

    return abilityMod;
  }

  /** Calculates spell save DC. */
  async calculateSpellSaveDC(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = await this.calculateAbilityModifier(spellcastingAbilityScore);
    return 8 + proficiencyBonus + abilityModifier;
  }

  /** Calculates spell attack bonus. */
  async calculateSpellAttackBonus(proficiencyBonus: number, spellcastingAbilityScore: number): Promise<number> {
    const abilityModifier = await this.calculateAbilityModifier(spellcastingAbilityScore);
    return proficiencyBonus + abilityModifier;
  }

  /** Calculates maximum Hit Points for a character. */
  async calculateMaxHitPoints(level: number, conScore: number, classHitDie: `d${6 | 8 | 10 | 12}` | null): Promise<number> {
     if (!classHitDie || level < 1) {
         return 0; // Cannot calculate without hit die or level
     }
     const conModifier = await this.calculateAbilityModifier(conScore); // Calculate modifier from score

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
}
