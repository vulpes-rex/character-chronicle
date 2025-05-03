
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollectionReference, DocumentReference, Firestore, Query, Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import type { Character } from '@character-chronicle/shared/types'; // Use shared library path
import { LoggingService } from '../logging/logging.service'; // Updated path
import { FeaturesService } from '../features/features.service'; // Updated path

@Injectable()
export class CharacterService {
  private readonly charactersCollection: CollectionReference<Character>;

  constructor(
    @Inject('FIRESTORE') private readonly firestore: Firestore,
    private readonly logger: LoggingService,
    private readonly featuresService: FeaturesService,
  ) {
    // Type casting needed because Firestore types don't perfectly match our interface
    this.charactersCollection = collection(this.firestore, 'characters') as CollectionReference<Character>;
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

    const dataToSave = {
        playerId: userId,
        playerName: characterData.playerName,
        characterName: characterData.characterName,
        race: characterData.race || 'Unknown Race',
        class: characterData.class || 'Unknown Class',
        level: characterData.level || 1,
        background: characterData.background || 'Unknown Background',
        alignment: characterData.alignment || 'Neutral',
        stats: characterData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(this.charactersCollection, dataToSave);
      this.logger.log(`Character saved with ID: ${docRef.id}`);
      return docRef.id;
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
    const characterDoc = doc(this.firestore, 'characters', characterId) as DocumentReference<Character>;

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
        'stats', 'skills', 'hitPoints', 'hitDice', 'equipment', 'proficiencies',
        'features', 'featureChoices', 'spellcasting', 'spellsKnown', 'spellsPrepared',
        'backstory', 'appearance', 'campaignId'
     ];

     for (const key of allowedFields) {
         if (key in characterUpdates) {
             dataToUpdate[key] = characterUpdates[key];
         }
     }

    // Special handling for partial updates of nested objects
    if ('hitPoints' in dataToUpdate && typeof dataToUpdate.hitPoints === 'object' && dataToUpdate.hitPoints !== null && !('max' in dataToUpdate.hitPoints)) {
        dataToUpdate.hitPoints.max = existingChar.hitPoints.max; // Preserve existing max
    }
     if ('hitDice' in dataToUpdate && typeof dataToUpdate.hitDice === 'object' && dataToUpdate.hitDice !== null && (!('total' in dataToUpdate.hitDice) || !('dieType' in dataToUpdate.hitDice))) {
         dataToUpdate.hitDice.total = existingChar.hitDice.total;
         dataToUpdate.hitDice.dieType = existingChar.hitDice.dieType; // Preserve existing total/type
     }

    dataToUpdate.updatedAt = serverTimestamp();
    this.logger.debug(`Updating character ${characterId}`, { updateKeys: Object.keys(dataToUpdate) });

    try {
      await updateDoc(characterDoc, dataToUpdate);
      this.logger.log(`Character updated with ID: ${characterId}`);
    } catch (e) {
      this.logger.error(`Error updating character ${characterId}`, e instanceof Error ? e.stack : undefined, { userId });
      throw new Error('Failed to update character.');
    }
  }

  /** Loads a specific character from Firestore. */
  async loadCharacter(characterId: string, applyRules: boolean = true): Promise<Character | null> {
    if (!characterId) { this.logger.warn("Attempted to load character with empty ID."); return null; }
    const characterDoc = doc(this.firestore, 'characters', characterId) as DocumentReference<Character>;

    try {
      const docSnap = await getDoc(characterDoc);
      if (!docSnap.exists()) {
        this.logger.log(`No character document found for ID: ${characterId}`);
        return null;
      }
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

      const baseCharacter: Character = {
          id: docSnap.id,
          playerId: data.playerId || null,
          playerName: data.playerName || 'Unknown Player',
          characterName: data.characterName || 'Unnamed Character',
          race: data.race || 'Unknown Race',
          class: data.class || 'Unknown Class',
          level: data.level || 1,
          background: data.background || 'Unknown Background',
          alignment: data.alignment || 'Neutral',
          stats: data.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
          skills: data.skills || {},
          hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
          hitDice: data.hitDice || { total: data.level || 1, remaining: data.level || 1, dieType: null },
          equipment: Array.isArray(data.equipment) ? data.equipment : [],
          proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
          features: Array.isArray(data.features) ? data.features : [],
          featureChoices: data.featureChoices || {},
          spellcasting: data.spellcasting,
          spellsKnown: data.spellsKnown || [],
          spellsPrepared: data.spellsPrepared || [],
          backstory: data.backstory || '',
          appearance: data.appearance || '',
          campaignId: data.campaignId,
          createdAt: createdAt,
          updatedAt: updatedAt,
      };

      if (!applyRules) {
        this.logger.debug(`Loaded base character ${characterId} without applying rules.`);
        return baseCharacter;
      }

      // Apply feature rules using the injected FeaturesService
      const characterWithDerived = await this.featuresService.applyFeatureRules(baseCharacter);
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
    const q = query(this.charactersCollection, where('playerId', '==', playerId)) as Query<Character>;

    try {
      const querySnapshot = await getDocs(q);
      this.logger.debug(`Found ${querySnapshot.docs.length} character documents for playerId: ${playerId}`);
      const characters: Character[] = [];

      await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

        const baseCharacter: Character = {
            id: docSnap.id,
            playerId: data.playerId,
            playerName: data.playerName || 'Unknown Player',
            characterName: data.characterName || 'Unnamed Character',
            race: data.race || 'Unknown Race',
            class: data.class || 'Unknown Class',
            level: data.level || 1,
            background: data.background || 'Unknown Background',
            alignment: data.alignment || 'Neutral',
            stats: data.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: data.skills || {},
            hitPoints: data.hitPoints || { max: 0, current: 0, temporary: 0 },
            hitDice: data.hitDice || { total: data.level || 1, remaining: data.level || 1, dieType: null },
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
            proficiencies: data.proficiencies || { armor: [], weapons: [], tools: [], savingThrows: [], languages: [] },
            features: Array.isArray(data.features) ? data.features : [],
            featureChoices: data.featureChoices || {},
            spellcasting: data.spellcasting,
            spellsKnown: data.spellsKnown || [],
            spellsPrepared: data.spellsPrepared || [],
            backstory: data.backstory || '',
            appearance: data.appearance || '',
            campaignId: data.campaignId,
            createdAt: createdAt,
            updatedAt: updatedAt,
        };

        try {
          const characterWithDerived = await this.featuresService.applyFeatureRules(baseCharacter);
          characters.push(characterWithDerived);
        } catch (ruleError) {
            this.logger.error(`Error applying rules to character ${baseCharacter.id}`, ruleError instanceof Error ? ruleError.stack : undefined);
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
    const characterDoc = doc(this.firestore, 'characters', characterId) as DocumentReference<Character>;

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
      await deleteDoc(characterDoc);
      this.logger.log(`Character deleted with ID: ${characterId}`);
    } catch (e) {
      this.logger.error(`Error deleting character ${characterId}`, e instanceof Error ? e.stack : undefined, { userId });
      throw new Error('Failed to delete character.');
    }
  }
}
