
import { Injectable } from '@nestjs/common';
import { Engine, Rule } from 'json-rules-engine';
import type { Character, EquipmentItem, Feature, FeatureEffectMetadata, Monster, NPC } from '@/lib/types';
import { SKILL_ABILITY_MAP } from '@/lib/types';
import { LoggingService } from '@/nestjs/logging/logging.service'; // Use NestJS logger

@Injectable()
export class RulesService {
  constructor(private readonly logger: LoggingService) {}

  // --- Helper function ---
  private calculateMod(score: number | undefined | null): number {
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
        event.params!.modifier = this.calculateMod(score);
    },
  });

  private skillModifierRule = new Rule({
    conditions: { all: [{ fact: 'abilityScore', operator: 'greaterThanInclusive', value: 1 }] },
    event: { type: 'calculate-skill-modifier', params: { modifier: 0 } },
    onSuccess: async (event, almanac) => {
        const abilityScore = await almanac.factValue('abilityScore');
        const isProficient = await almanac.factValue('isProficient');
        const proficiencyBonus = await almanac.factValue('proficiencyBonus');
        const baseModifier = this.calculateMod(abilityScore);
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
    const engine = new Engine([this.abilityModifierRule]);
    try {
        const { events } = await engine.run({ score: score });
        return events.length > 0 ? events[0].params?.modifier || 0 : 0;
    } catch (error) {
        this.logger.error('Error calculating ability modifier', error instanceof Error ? error.stack : undefined, 'RulesService', { score });
        return 0;
    }
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

  /** Calculates a character's Armor Class (AC). (Simplified) */
   async calculateArmorClass(character: Character): Promise<number> {
       // TODO: Implement comprehensive AC calculation using json-rules-engine
       // This is a simplified placeholder.
       this.logger.debug(`Calculating AC for character ${character.id}`, 'RulesService');
       let ac = 10; // Default base
       const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);
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

       this.logger.debug(`Calculated AC (placeholder) for ${character.id}: ${ac}`, 'RulesService');
       return ac;
   }


  /** Calculates the "to hit" bonus for a given weapon attack. */
  async calculateHitBonus(weapon: EquipmentItem, character: Character, proficiencyBonus: number): Promise<number> {
    const isProficient = character.proficiencies?.weapons?.includes(weapon.weaponCategory || '') ||
                         character.proficiencies?.weapons?.includes(weapon.name);

    const strMod = await this.calculateAbilityModifier(character.stats.strength);
    const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);

    let baseAbilityMod = strMod;
    if (weapon.properties?.includes('Finesse')) baseAbilityMod = Math.max(strMod, dexMod);
    else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) baseAbilityMod = dexMod;

    const facts = {
        baseAbilityModifier: baseAbilityMod,
        isProficient: isProficient,
        proficiencyBonus: proficiencyBonus,
        isRangedWeapon: weapon.weaponCategory?.toLowerCase().includes('ranged') ?? false,
        features: character.features.map(f => f.name),
    };

    const engine = new Engine([this.hitBonusRule, this.archeryStyleRule]);

    try {
        const { events } = await engine.run(facts);
        let totalBonus = 0;
        events.forEach(event => { if (event.params?.bonus) totalBonus += event.params.bonus; });
        this.logger.debug(`Calculated hit bonus for ${character.id} with ${weapon.name}: ${totalBonus}`, 'RulesService');
        return totalBonus;
    } catch (error) {
        this.logger.error(`Error calculating hit bonus for ${weapon.name}`, error instanceof Error ? error.stack : undefined, 'RulesService', { characterId: character.id });
        return 0;
    }
  }

  /** Calculates the damage bonus for a given weapon attack. */
  async calculateDamageBonus(weapon: EquipmentItem, character: Character): Promise<number> {
    const strMod = await this.calculateAbilityModifier(character.stats.strength);
    const dexMod = await this.calculateAbilityModifier(character.stats.dexterity);

    let baseAbilityMod = strMod;
    if (weapon.properties?.includes('Finesse')) baseAbilityMod = Math.max(strMod, dexMod);
    else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) baseAbilityMod = dexMod;

    // TODO: Determine isWieldingOneHandedMelee accurately based on equipment state
    const facts = {
        baseAbilityModifier: baseAbilityMod,
        features: character.features.map(f => f.name),
        isWieldingOneHandedMelee: true, // Placeholder
    };

    const engine = new Engine([this.damageBonusRule, this.duelingStyleRule]);

    try {
        const { events } = await engine.run(facts);
        let totalBonus = 0;
        events.forEach(event => { if (event.params?.bonus) totalBonus += event.params.bonus; });
        this.logger.debug(`Calculated damage bonus for ${character.id} with ${weapon.name}: ${totalBonus}`, 'RulesService');
        return totalBonus;
    } catch (error) {
        this.logger.error(`Error calculating damage bonus for ${weapon.name}`, error instanceof Error ? error.stack : undefined, 'RulesService', { characterId: character.id });
        return 0;
    }
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
    if (!classHitDie || level < 1) return 0;
    const conModifier = await this.calculateAbilityModifier(conScore);
    const hitDieSides = parseInt(classHitDie.substring(1), 10);
    if (isNaN(hitDieSides)) return 0;

    let maxHp = hitDieSides + conModifier; // Level 1
    if (level > 1) {
        const averageHpPerLevel = Math.ceil((hitDieSides + 1) / 2);
        maxHp += (level - 1) * (averageHpPerLevel + conModifier);
    }
    return Math.max(1, maxHp);
  }
}
