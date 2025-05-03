
import { Injectable } from '@nestjs/common';
import type { Feature, FeatureEffectMetadata, SourcePack, CharacterClass, CharacterRace, BackgroundInfo, Character, SpellcastingGrantMetadata, ProficiencyGrantMetadata, ChoiceGrantMetadata, NPC, Monster } from '@/lib/types';
import { ALL_SKILLS, SKILL_ABILITY_MAP, SPELL_SLOTS_BY_LEVEL } from '@/lib/types';
import { LoggingService } from '@/nestjs/logging/logging.service';
import { RulesService } from '@/nestjs/rules/rules.service'; // Import RulesService for calculations
import { SRD_SOURCE_PACK } from '@/lib/srd-data';

@Injectable()
export class FeaturesService {
  constructor(
    private readonly logger: LoggingService,
    private readonly rulesService: RulesService, // Inject RulesService
  ) {}

  /** Fetches the full definition of a feature by its key/name. */
  async getFeatureDefinition(
    featureKey: string,
    combinedContent?: SourcePack['content']
  ): Promise<Feature | null> {
    try {
        if (combinedContent?.features && combinedContent.features[featureKey]) {
            this.logger.debug(`Found feature "${featureKey}" in source pack content.`, 'FeaturesService');
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

        const srdFeatureData = SRD_SOURCE_PACK.content.features?.[featureKey];
        if (srdFeatureData) {
             this.logger.debug(`Found feature "${featureKey}" in SRD definitions.`, 'FeaturesService');
             return {
                 name: featureKey,
                 description: srdFeatureData.description || '',
                 source: srdFeatureData.source || 'SRD',
                 metadata: srdFeatureData.metadata,
                 isActionable: srdFeatureData.isActionable,
                 maxUses: srdFeatureData.maxUses,
                 usesResetOn: srdFeatureData.usesResetOn,
                 currentUses: srdFeatureData.currentUses,
             };
        }

        this.logger.warn(`Feature definition not found for key: "${featureKey}".`, 'FeaturesService');
        return null;
    } catch (error) {
        this.logger.error(`Error getting feature definition for ${featureKey}`, error instanceof Error ? error.stack : undefined, 'FeaturesService', { hasCombinedContent: !!combinedContent });
        return null;
    }
  }

  /** Fetches definitions for multiple features. */
  async getMultipleFeatureDefinitions(
    featureKeys: string[],
    combinedContent?: SourcePack['content']
  ): Promise<Feature[]> {
    if (!featureKeys || featureKeys.length === 0) return [];
    const featurePromises = featureKeys.map(key => this.getFeatureDefinition(key, combinedContent));
    const results = await Promise.all(featurePromises);
    return results.filter((feature): feature is Feature => feature !== null);
  }

  /** Retrieves features granted by a specific race name. */
  async getRaceFeatures(
    raceName: string,
    combinedContent?: SourcePack['content']
  ): Promise<Feature[]> {
    if (!raceName) { this.logger.warn('getRaceFeatures called without raceName.', 'FeaturesService'); return []; }
    const raceData = combinedContent?.races?.[raceName] ?? SRD_SOURCE_PACK.content.races?.[raceName];
    let featureKeys: string[] = [];
    if (raceData?.traits) { featureKeys = raceData.traits; this.logger.debug(`Found race "${raceName}", fetching features: ${featureKeys.join(', ')}`, 'FeaturesService'); }
    else { this.logger.warn(`Race "${raceName}" not found or has no traits.`, 'FeaturesService'); }
    return this.getMultipleFeatureDefinitions(featureKeys, combinedContent);
  }

  /** Retrieves cumulative features granted by a specific class up to a given level. */
  async getClassFeatures(
    className: string,
    level: number,
    combinedContent?: SourcePack['content']
  ): Promise<Feature[]> {
    if (!className || level < 1) { this.logger.warn('getClassFeatures called without className or invalid level.', 'FeaturesService'); return []; }
    const classData: CharacterClass | undefined = combinedContent?.classes?.[className] ?? SRD_SOURCE_PACK.content.classes?.[className];
    const usingSource = combinedContent?.classes?.[className] ? "Source Pack" : "SRD";
    if (!classData) { this.logger.error(`Class definition not found for "${className}" in ${usingSource}.`, 'FeaturesService'); return []; }

    let allFeatureKeys: string[] = [];
    this.logger.debug(`Accumulating features for ${className} up to level ${level} from ${usingSource}.`, 'FeaturesService');
    if (classData.featuresByLevel) {
        for (let i = 1; i <= level; i++) { if (classData.featuresByLevel[i]) allFeatureKeys.push(...classData.featuresByLevel[i]); }
    } else { this.logger.warn(`Class "${className}" from ${usingSource} lacks 'featuresByLevel'.`, 'FeaturesService'); }

    const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
    this.logger.debug(`Unique feature keys for ${className} level ${level}: ${uniqueFeatureKeys.join(', ')}`, 'FeaturesService');
    if (uniqueFeatureKeys.length === 0) return [];

    try { return await this.getMultipleFeatureDefinitions(uniqueFeatureKeys, combinedContent); }
    catch (error) { this.logger.error(`Failed to fetch features for class ${className}`, error instanceof Error ? error.stack : undefined, 'FeaturesService', { level, uniqueFeatureKeys }); throw new Error(`Failed to fetch features for class ${className}.`); }
  }

  /** Retrieves features and proficiencies granted by a specific background name. */
  async getBackgroundFeatures(
    backgroundName: string,
    combinedContent?: SourcePack['content']
  ): Promise<Feature[]> {
    if (!backgroundName) { this.logger.warn('getBackgroundFeatures called without backgroundName.', 'FeaturesService'); return []; }
    let backgroundData: BackgroundInfo | null | undefined = combinedContent?.backgrounds?.[backgroundName] ?? SRD_SOURCE_PACK.content.backgrounds?.[backgroundName];
    const usingSource = combinedContent?.backgrounds?.[backgroundName] ? "Source Pack" : "SRD";
    if (!backgroundData) { this.logger.warn(`Background "${backgroundName}" not found in ${usingSource}.`, 'FeaturesService'); return []; }
    this.logger.debug(`Found background "${backgroundName}" in ${usingSource}.`, 'FeaturesService');
    let features: Feature[] = [];

    if (backgroundData.feature?.name) {
        const mainFeatureDef = await this.getFeatureDefinition(backgroundData.feature.name, combinedContent);
        if (mainFeatureDef) features.push({ ...mainFeatureDef, source: `${backgroundName} Background` });
        else features.push({ name: backgroundData.feature.name, description: backgroundData.feature.description || 'No description.', source: `${backgroundName} Background` });
    }

    if (backgroundData.skillProficiencies?.length) features.push({ name: `${backgroundName} Skill Proficiencies`, description: `Gain proficiency in ${backgroundData.skillProficiencies.join(' and ')}.`, source: `${backgroundName} Background`, metadata: { effectType: 'proficiencyGrant', type: 'skill', proficiencies: backgroundData.skillProficiencies } });
    if (backgroundData.toolProficiencies?.length) features.push({ name: `${backgroundName} Tool Proficiencies`, description: `Gain proficiency with ${backgroundData.toolProficiencies.join(' and ')}.`, source: `${backgroundName} Background`, metadata: { effectType: 'proficiencyGrant', type: 'tool', proficiencies: backgroundData.toolProficiencies } });
    if (backgroundData.languages?.choose) features.push({ name: `${backgroundName} Languages`, description: `Choose ${backgroundData.languages.choose} extra language(s)...`, source: `${backgroundName} Background`, metadata: { effectType: "proficiencyGrant", type: "language", choose: backgroundData.languages.choose, options: backgroundData.languages.options || SRD_SOURCE_PACK.content.features?.['ExtraLanguage']?.metadata?.options || [], choiceKey: `${backgroundName}Languages` } });

    return features;
  }


  /** Applies the effects of a character's features to their base state. */
  async applyFeatureRules(baseCharacter: Character): Promise<Character> {
      this.logger.debug(`Applying feature rules for character ${baseCharacter.id}`, 'FeaturesService');
      if (!baseCharacter.features || baseCharacter.features.length === 0) {
          this.logger.debug(`No features found for character ${baseCharacter.id}. Returning base character.`, 'FeaturesService');
          return { ...baseCharacter };
      }

      const derivedCharacter = JSON.parse(JSON.stringify(baseCharacter)) as Character;
      const finalStats = { ...(baseCharacter.stats || {}) };
      const finalProficiencies = {
          armor: [...(baseCharacter.proficiencies?.armor ?? [])],
          weapons: [...(baseCharacter.proficiencies?.weapons ?? [])],
          tools: [...(baseCharacter.proficiencies?.tools ?? [])],
          savingThrows: [...(baseCharacter.proficiencies?.savingThrows ?? [])],
          languages: [...(baseCharacter.proficiencies?.languages ?? [])],
      };
      const finalSkills = { ...(baseCharacter.skills || {}) };
      let spellcastingAbility: keyof Character['stats'] | null = null;
      let spellProgression: CharacterClass['spellProgression'] = 'none';
      let knownSpellsFromFeatures: string[] = [];

      for (const feature of baseCharacter.features) {
          if (!feature.metadata) continue;
          try {
              const metadata = feature.metadata as FeatureEffectMetadata;
              switch (metadata.effectType) {
                  case 'statBonus':
                      Object.entries(metadata.stats).forEach(([stat, bonus]) => {
                          if (finalStats[stat as keyof typeof finalStats] !== undefined) { finalStats[stat as keyof typeof finalStats] += bonus; }
                          else { this.logger.warn(`Stat bonus for non-existent stat '${stat}' in feature '${feature.name}'`, 'FeaturesService'); }
                      });
                      break;
                  case 'proficiencyGrant':
                      const choiceKeyProf = metadata.choiceKey || feature.name;
                      const chosenProficiencies = baseCharacter.featureChoices?.[choiceKeyProf];
                      let profsToGrant: string[] = [];
                      if (metadata.choose && metadata.options) {
                          if (Array.isArray(chosenProficiencies)) profsToGrant = chosenProficiencies.filter(choice => metadata.options?.includes(choice));
                          else if (chosenProficiencies && typeof chosenProficiencies === 'string' && metadata.choose === 1 && metadata.options?.includes(chosenProficiencies)) profsToGrant = [chosenProficiencies];
                          else this.logger.warn(`No/Invalid choices for proficiency grant feature "${feature.name}"`, 'FeaturesService', { choiceKeyProf, choices: baseCharacter.featureChoices });
                      } else { profsToGrant = metadata.proficiencies || []; }

                      const addProficiency = (type: keyof typeof finalProficiencies, profs: string[]) => { if (Array.isArray(finalProficiencies[type])) finalProficiencies[type].push(...profs); };
                      switch (metadata.type) {
                          case 'armor': addProficiency('armor', profsToGrant); break;
                          case 'weapon': addProficiency('weapons', profsToGrant); break;
                          case 'tool': addProficiency('tools', profsToGrant); break;
                          case 'savingThrow': addProficiency('savingThrows', profsToGrant); break;
                          case 'language': addProficiency('languages', profsToGrant); break;
                          case 'skill': profsToGrant.forEach(skill => { if (ALL_SKILLS.includes(skill.toLowerCase())) finalSkills[skill.toLowerCase()] = true; else this.logger.warn(`Granted proficiency for unknown skill '${skill}' by feature '${feature.name}'`, 'FeaturesService'); }); break;
                      }
                      break;
                  case 'spellcastingGrant':
                      if (!spellcastingAbility || feature.source.includes('Class')) { // Simple check
                          spellcastingAbility = (metadata as SpellcastingGrantMetadata).ability;
                          const classData = SRD_SOURCE_PACK.content.classes?.[baseCharacter.class];
                          spellProgression = (metadata as SpellcastingGrantMetadata).preparationType === 'known' ? 'known' : (metadata as SpellcastingGrantMetadata).preparationType === 'prepared' ? 'prepared' : classData?.spellProgression || 'none';
                      }
                      break;
                   case 'spellsKnownGrant': if (metadata.spells) knownSpellsFromFeatures.push(...metadata.spells); break;
                   // Informational types handled elsewhere
                   case 'acBonus': case 'acCalculation': case 'advantage': case 'resistance': case 'choiceGrant': this.logger.debug(`Informational feature processed: ${feature.name} (${metadata.effectType})`, 'FeaturesService'); break;
                  default: this.logger.warn(`Unknown/unhandled effectType: ${(metadata as any).effectType} for feature ${feature.name}`, 'FeaturesService');
              }
          } catch (error) { this.logger.error(`Error applying feature ${feature.name}`, error instanceof Error ? error.stack : undefined, 'FeaturesService', { characterId: baseCharacter.id }); }
      }

      // Ensure unique proficiencies
      derivedCharacter.proficiencies = { armor: [...new Set(finalProficiencies.armor)], weapons: [...new Set(finalProficiencies.weapons)], tools: [...new Set(finalProficiencies.tools)], savingThrows: [...new Set(finalProficiencies.savingThrows)], languages: [...new Set(finalProficiencies.languages)] };
      derivedCharacter.skills = finalSkills;
      derivedCharacter.stats = finalStats; // Apply final base stats

      // Max HP
      const classDataHP = SRD_SOURCE_PACK.content.classes?.[baseCharacter.class];
      const maxHp = await this.rulesService.calculateMaxHitPoints(baseCharacter.level, finalStats.constitution, classDataHP?.hitDie || null);
      derivedCharacter.hitPoints = { max: maxHp, current: Math.min(baseCharacter.hitPoints?.current ?? maxHp, maxHp), temporary: baseCharacter.hitPoints?.temporary ?? 0 };
      derivedCharacter.hitDice = { total: baseCharacter.level, remaining: Math.min(baseCharacter.hitDice?.remaining ?? baseCharacter.level, baseCharacter.level), dieType: classDataHP?.hitDie || null };

      // Spellcasting Details
      if (spellcastingAbility) {
          const profBonus = baseCharacter.level >= 17 ? 6 : baseCharacter.level >= 13 ? 5 : baseCharacter.level >= 9 ? 4 : baseCharacter.level >= 5 ? 3 : 2;
          derivedCharacter.spellcasting = {
              ability: spellcastingAbility,
              spellSaveDC: await this.rulesService.calculateSpellSaveDC(profBonus, finalStats[spellcastingAbility] ?? 10),
              spellAttackBonus: await this.rulesService.calculateSpellAttackBonus(profBonus, finalStats[spellcastingAbility] ?? 10),
              slots: {},
          };
          const progressionKey = spellProgression === 'known' || spellProgression === 'prepared' ? 'full' : spellProgression;
          const slotsTable = SPELL_SLOTS_BY_LEVEL[progressionKey || 'none'];
          if (slotsTable && baseCharacter.level > 0 && baseCharacter.level <= slotsTable.length) {
              const levelSlots = slotsTable[baseCharacter.level - 1];
              levelSlots.forEach((maxSlots, index) => {
                  const spellLevel = index + 1;
                  if (maxSlots > 0) { derivedCharacter.spellcasting!.slots[String(spellLevel)] = { max: maxSlots, remaining: baseCharacter.spellcasting?.slots?.[String(spellLevel)]?.remaining ?? maxSlots }; }
              });
          } else if (spellProgression !== 'none') { this.logger.warn(`Could not determine spell slots for level ${baseCharacter.level} and progression '${progressionKey}'`, 'FeaturesService'); }
          derivedCharacter.spellsKnown = [...new Set([...(baseCharacter.spellsKnown || []), ...knownSpellsFromFeatures])];
          derivedCharacter.spellsPrepared = [...new Set(baseCharacter.spellsPrepared || [])];
      } else { derivedCharacter.spellcasting = undefined; }

      // Preserve current uses
      derivedCharacter.features = baseCharacter.features.map(baseFeature => ({ ...baseFeature, currentUses: baseFeature.currentUses ?? baseFeature.maxUses ?? undefined }));

      this.logger.debug(`Finished applying feature rules for character ${baseCharacter.id}.`, 'FeaturesService');
      return derivedCharacter;
  }
}
