
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollectionReference, DocumentReference, Firestore, Query, Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import type { Character } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { FeaturesService } from '../features/features.service'; // Updated path
import { CharacterRepository } from '../repositories/character.repository';
import { RulesService } from '../rules/rules.service'; // Import RulesService

@Injectable()
export class CharacterService {

  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly logger: LoggingService,
    private readonly featuresService: FeaturesService,
    private readonly rulesService: RulesService, // Inject RulesService
  ) {
    this.logger.setContext('CharacterService');
  }

  /** Saves a new character to Firestore. */
  async saveCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> {
    if (!userId) {
      this.logger.error("Attempted to save character without a user ID.", undefined, { characterName: characterData?.characterName });
      throw new Error("User ID is required to save a character.");
    }
    if (!characterData || !characterData.characterName || !characterData.playerName) {
      this.logger.error("Attempted to save character with missing core data.", undefined, { characterName: characterData?.characterName });
      throw new Error("Missing required character data (e.g., character name, player name).");
    }
    this.logger.debug('Saving character data (base values):', { characterData });

    const dataToSave: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
        playerId: userId,
        playerName: characterData.playerName,
        characterName: characterData.characterName,
        race: characterData.race || 'Unknown Race',
        class: characterData.class || 'Unknown Class',
        level: characterData.level || 1,
        background: characterData.background || 'Unknown Background',
        alignment: characterData.alignment || 'Neutral',
        // Store only base stats
        baseStats: characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        skills: characterData.skills || {},
        hitPoints: characterData.hitPoints || { max: 0, current: 0, temporary: 0 },
        hitDice: characterData.hitDice || { total: characterData.level || 1, remaining: characterData.level || 1, dieType: null },
        equipment: characterData.equipment || [],
        proficiencies: characterData.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
        features: characterData.features || [],
        featureChoices: characterData.featureChoices || {},
        spellsKnown: characterData.spellsKnown || [],
        spellsPrepared: characterData.spellsPrepared || [],
        backstory: characterData.backstory || '',
        appearance: characterData.appearance || '',
        campaignId: characterData.campaignId,
        // Remove derived/calculated fields like stats, spellcasting
    };

    try {
      // Repository's create will handle timestamps
      const characterId = await this.characterRepository.create(dataToSave as any);
      this.logger.log(`Character saved with ID: ${characterId}`);
      return characterId;
    } catch (e) {
      this.logger.error(`Error saving character ${characterData.characterName}`, e instanceof Error ? e.stack : undefined, { userId });
      throw new Error('Failed to save character.');
    }
  }

  /** Updates specific fields of an existing character in Firestore. */
  async updateCharacter(characterId: string, characterUpdates: Partial<Omit<Character, 'id' | 'createdAt' | 'playerId'>>, userId: string): Promise<void> {
    if (!characterId || !userId) {
      this.logger.error("Attempted to update character with missing ID or User ID.", undefined, { characterId, userId });
      throw new Error("Character ID and User ID are required for update.");
    }
    if (!characterUpdates || Object.keys(characterUpdates).length === 0) {
      this.logger.warn(`Attempted to update character ${characterId} with empty data.`);
      return;
    }

    // Permission Check
    const existingChar = await this.loadCharacter(characterId, false); // Load base data for check
    if (!existingChar) {
      this.logger.error(`Character ${characterId} not found for update.`);
      throw new NotFoundException(`Character ${characterId} not found.`);
    }
    if (existingChar.playerId !== userId) {
       this.logger.warn(`Permission denied: User ${userId} cannot update character ${characterId} owned by ${existingChar.playerId}.`);
      throw new ForbiddenException('You do not have permission to update this character.');
    }

    // Prepare data (only allow updating specific fields, ensure types)
     const dataToUpdate: Record<string, any> = {};
     const allowedFields: Array<keyof typeof characterUpdates> = [
        'playerName', 'characterName', 'race', 'class', 'level', 'background', 'alignment',
        'baseStats', // Update baseStats instead of stats
        'skills', 'hitPoints', 'hitDice', 'equipment', 'proficiencies',
        'features', 'featureChoices', /* remove spellcasting */ 'spellsKnown', 'spellsPrepared',
        'backstory', 'appearance', 'campaignId'
     ];

     for (const key of allowedFields) {
         if (key in characterUpdates) {
             dataToUpdate[key] = characterUpdates[key];
         }
     }

    // Special handling for partial updates of nested objects (HP, HitDice) - KEEP THIS
    if ('hitPoints' in dataToUpdate && typeof dataToUpdate.hitPoints === 'object' && dataToUpdate.hitPoints !== null && !('max' in dataToUpdate.hitPoints)) {
        dataToUpdate.hitPoints.max = existingChar.hitPoints.max; // Preserve existing max
    }
     if ('hitDice' in dataToUpdate && typeof dataToUpdate.hitDice === 'object' && dataToUpdate.hitDice !== null && (!('total' in dataToUpdate.hitDice) || !('dieType' in dataToUpdate.hitDice))) {
         dataToUpdate.hitDice.total = existingChar.hitDice.total;
         dataToUpdate.hitDice.dieType = existingChar.hitDice.dieType; // Preserve existing total/type
     }

    // Remove calculated fields if accidentally included
    delete dataToUpdate.stats;
    delete dataToUpdate.spellcasting;

    this.logger.debug(`Updating character ${characterId}`, { updateKeys: Object.keys(dataToUpdate) });

    try {
      // Repository's update will handle timestamps
      await this.characterRepository.update(characterId, dataToUpdate);
      this.logger.log(`Character updated with ID: ${characterId}`);
    } catch (e) {
      this.logger.error(`Error updating character ${characterId}`, e instanceof Error ? e.stack : undefined, { userId });
      throw new Error('Failed to update character.');
    }
  }

  /** Loads a specific character from Firestore. */
  async loadCharacter(characterId: string, applyRules: boolean = true): Promise<Character | null> {
    if (!characterId) { this.logger.warn("Attempted to load character with empty ID."); return null; }

    try {
      const baseCharacterData = await this.characterRepository.findById(characterId);
      if (!baseCharacterData) {
        this.logger.log(`No character document found for ID: ${characterId}`);
        return null;
      }

      // Ensure baseStats exists if stats was previously used
       const characterWithBaseStats: Character = {
          ...baseCharacterData,
          baseStats: baseCharacterData.baseStats || baseCharacterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
       }
       delete (characterWithBaseStats as any).stats; // Remove the old stats field if present

      if (!applyRules) {
        this.logger.debug(`Loaded base character ${characterId} without applying rules.`);
        return characterWithBaseStats;
      }

      // Apply feature rules using the injected FeaturesService
      const characterWithDerived = await this.featuresService.applyFeatureRules(characterWithBaseStats);
      this.logger.debug(`Loaded character ${characterId} and applied feature rules.`);
      return characterWithDerived;

    } catch (e) {
      this.logger.error(`Error loading character ${characterId}`, e instanceof Error ? e.stack : undefined);
      throw new Error('Failed to load character.');
    }
  }

  /** Loads all characters belonging to a specific player. */
  async loadAllCharacters(playerId?: string): Promise<Character[]> {
    if (!playerId) { this.logger.warn("loadAllCharacters called without a playerId."); return []; }
    this.logger.debug(`Loading all characters for playerId: ${playerId}`);

    try {
      const baseCharactersData = await this.characterRepository.findByPlayerId(playerId);
      this.logger.debug(`Found ${baseCharactersData.length} character documents for playerId: ${playerId}`);

      const characters: Character[] = [];
      await Promise.all(baseCharactersData.map(async (baseData) => {
        try {
          // Ensure baseStats exists
           const characterWithBaseStats: Character = {
                ...baseData,
                baseStats: baseData.baseStats || baseData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
           }
           delete (characterWithBaseStats as any).stats;

          const characterWithDerived = await this.featuresService.applyFeatureRules(characterWithBaseStats);
          characters.push(characterWithDerived);
        } catch (ruleError) {
            this.logger.error(`Error applying rules to character ${baseData.id}`, ruleError instanceof Error ? ruleError.stack : undefined);
            // Optionally push baseCharacter here if desired on rule error
        }
      }));

      characters.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      this.logger.debug(`Finished loading and processing ${characters.length} characters for playerId: ${playerId}`);
      return characters;
    } catch (e) {
      this.logger.error(`Error loading all characters for player ${playerId}`, e instanceof Error ? e.stack : undefined);
      throw new Error('Failed to load characters.');
    }
  }

  /** Deletes a character from Firestore. */
  async deleteCharacter(characterId: string, userId: string): Promise<void> {
    if (!characterId || !userId) {
       this.logger.error("Attempted to delete character with missing ID or User ID.", undefined, { characterId, userId });
       throw new Error("Character ID and User ID are required for deletion.");
    }

    // Permission Check
    const existingChar = await this.loadCharacter(characterId, false); // Load base data
    if (!existingChar) {
      this.logger.error(`Character ${characterId} not found for deletion.`);
      throw new NotFoundException(`Character ${characterId} not found.`);
    }
    if (existingChar.playerId !== userId) {
      this.logger.warn(`Permission denied: User ${userId} cannot delete character ${characterId} owned by ${existingChar.playerId}.`);
      throw new ForbiddenException('You do not have permission to delete this character.');
    }

    try {
      await this.characterRepository.delete(characterId);
      this.logger.log(`Character deleted with ID: ${characterId}`);
    } catch (e) {
      this.logger.error(`Error deleting character ${characterId}`, e instanceof Error ? e.stack : undefined, { userId });
      throw new Error('Failed to delete character.');
    }
  }

  // --- Rest and Feature Usage ---

    /** Handles the logic for a short rest. */
    async takeShortRest(characterId: string, userId: string, hitDiceToSpend: number): Promise<Character | null> {
        const character = await this.loadCharacter(characterId, false); // Load raw data
        if (!character || character.playerId !== userId) throw new ForbiddenException('Cannot take short rest for this character.');
        if (hitDiceToSpend < 0) throw new Error('Cannot spend negative hit dice.');
        if (hitDiceToSpend > (character.hitDice?.remaining ?? 0)) throw new Error('Not enough hit dice remaining.');

        let healthRecovered = 0;
        if (hitDiceToSpend > 0 && character.hitDice?.dieType) {
            const conMod = this.rulesService.calculateAbilityModifier(character.baseStats?.constitution);
            for (let i = 0; i < hitDiceToSpend; i++) {
                healthRecovered += Math.max(1, this.rulesService.rollDice(character.hitDice.dieType) + conMod);
            }
        }

        const newHp = Math.min(character.hitPoints.max, character.hitPoints.current + healthRecovered);
        const newRemainingHitDice = (character.hitDice?.remaining ?? 0) - hitDiceToSpend;

        // Reset short-rest features
        const updatedFeatures = character.features.map(f => {
            if (f.usesResetOn === 'short-rest') {
                return { ...f, currentUses: f.maxUses ?? undefined };
            }
            return f;
        });

        const updates: Partial<Character> = {
            hitPoints: { ...character.hitPoints, current: newHp },
            hitDice: { ...character.hitDice!, remaining: newRemainingHitDice },
            features: updatedFeatures,
        };

        await this.characterRepository.update(characterId, updates);
        this.logger.log(`Character ${characterId} took short rest. Recovered ${healthRecovered} HP. Spent ${hitDiceToSpend} hit dice.`);
        // Log the action
        // await this.addGameLogEntryAction({ campaignId: character.campaignId, actorId: characterId, actorName: character.characterName, actionType: 'shortRest', details: `Recovered ${healthRecovered} HP by spending ${hitDiceToSpend} hit dice.` });

        return this.loadCharacter(characterId); // Return updated character with derived stats
    }

    /** Handles the logic for a long rest. */
    async takeLongRest(characterId: string, userId: string): Promise<Character | null> {
        const character = await this.loadCharacter(characterId, false); // Load raw data
        if (!character || character.playerId !== userId) throw new ForbiddenException('Cannot take long rest for this character.');

        // Full HP recovery
        const newHp = character.hitPoints.max;

        // Recover half hit dice (minimum 1)
        const hitDiceRecovered = Math.max(1, Math.floor((character.hitDice?.total ?? 0) / 2));
        const newRemainingHitDice = Math.min(character.hitDice?.total ?? 0, (character.hitDice?.remaining ?? 0) + hitDiceRecovered);

        // Reset short and long rest features/spell slots
        const updatedFeatures = character.features.map(f => {
            if (f.usesResetOn === 'short-rest' || f.usesResetOn === 'long-rest') {
                return { ...f, currentUses: f.maxUses ?? undefined };
            }
            return f;
        });

        const updatedSpellSlots = { ...character.spellcasting?.slots };
        if (character.spellcasting?.slots) {
            Object.keys(character.spellcasting.slots).forEach(level => {
                updatedSpellSlots[level] = { ...updatedSpellSlots[level], remaining: updatedSpellSlots[level].max };
            });
        }

        const updates: Partial<Character> = {
            hitPoints: { ...character.hitPoints, current: newHp, temporary: 0 }, // Reset temp HP
            hitDice: { ...character.hitDice!, remaining: newRemainingHitDice },
            features: updatedFeatures,
            spellcasting: character.spellcasting ? { ...character.spellcasting, slots: updatedSpellSlots } : undefined,
        };

        await this.characterRepository.update(characterId, updates);
        this.logger.log(`Character ${characterId} took long rest.`);
         // Log the action
        // await this.addGameLogEntryAction({ campaignId: character.campaignId, actorId: characterId, actorName: character.characterName, actionType: 'longRest', details: `Completed a long rest.` });


        return this.loadCharacter(characterId); // Return updated character with derived stats
    }

    /** Uses a feature if it has uses remaining. */
     async useFeature(characterId: string, userId: string, featureName: string): Promise<Character | null> {
        const character = await this.loadCharacter(characterId, false); // Load raw data
        if (!character || character.playerId !== userId) throw new ForbiddenException('Cannot use feature for this character.');

        const featureIndex = character.features.findIndex(f => f.name === featureName);
        if (featureIndex === -1) throw new NotFoundException(`Feature "${featureName}" not found.`);

        const feature = character.features[featureIndex];
        if (feature.maxUses === null) throw new Error(`Feature "${featureName}" does not have limited uses.`);
        if ((feature.currentUses ?? feature.maxUses!) <= 0) throw new Error(`No uses remaining for feature "${featureName}".`);

        const updatedFeature = { ...feature, currentUses: (feature.currentUses ?? feature.maxUses!) - 1 };
        const updatedFeatures = [...character.features];
        updatedFeatures[featureIndex] = updatedFeature;

        await this.characterRepository.update(characterId, { features: updatedFeatures });
        this.logger.log(`Character ${characterId} used feature: ${featureName}. Uses remaining: ${updatedFeature.currentUses}`);
        // Log the action
        // await this.addGameLogEntryAction({ campaignId: character.campaignId, actorId: characterId, actorName: character.characterName, actionType: 'featureUse', details: `Used feature: ${featureName}.` });


        return this.loadCharacter(characterId); // Return updated character with derived stats
    }

    /** Casts a spell, consuming a spell slot. */
    async castSpell(characterId: string, userId: string, spellName: string, spellLevel: number): Promise<Character | null> {
        if (spellLevel < 0 || spellLevel > 9) throw new Error("Invalid spell level.");

        const character = await this.loadCharacter(characterId, false); // Load raw data
        if (!character || character.playerId !== userId) throw new ForbiddenException('Cannot cast spell for this character.');
        if (!character.spellcasting) throw new Error("Character does not have spellcasting ability.");

        const slotKey = String(spellLevel);
        const currentSlots = character.spellcasting.slots?.[slotKey];

        if (spellLevel > 0) { // Cantrips (level 0) don't use slots
            if (!currentSlots || currentSlots.remaining <= 0) {
                 throw new Error(`No level ${spellLevel} spell slots remaining.`);
            }
        }

        let updatedSlots = { ...character.spellcasting.slots };
        if (spellLevel > 0) {
            updatedSlots[slotKey] = { ...currentSlots!, remaining: currentSlots!.remaining - 1 };
        }

        await this.characterRepository.update(characterId, {
            spellcasting: { ...character.spellcasting, slots: updatedSlots }
        });
        this.logger.log(`Character ${characterId} cast spell: ${spellName} at level ${spellLevel}. Slots remaining: ${updatedSlots[slotKey]?.remaining ?? 'N/A'}`);
        // Log the action
        // await this.addGameLogEntryAction({ campaignId: character.campaignId, actorId: characterId, actorName: character.characterName, actionType: 'spellCast', details: `Cast ${spellName} (Level ${spellLevel}).`, spellDetails: { name: spellName, level: spellLevel } });


        return this.loadCharacter(characterId); // Return updated character with derived stats
    }


}
