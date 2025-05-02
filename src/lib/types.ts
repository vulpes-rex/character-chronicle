
/**
 * Represents the core data structure for a D&D character.
 */
export interface Character {
  id: string; // Unique identifier (e.g., Firestore document ID)
  playerName: string;
  characterName: string;
  race: string; // Name of the race (e.g., "Human", "Elf")
  class: string; // Name of the class (e.g., "Fighter", "Wizard") // Consider array for multiclass
  level: number;
  background: string;
  alignment: string;
  // Base ability scores before racial or other modifications.
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  // Skill proficiency selections (e.g., from background, class)
  skills: Record<string, boolean>; // Map skill name to proficiency status
  hitPoints: {
    max: number; // Max HP calculated based on class, level, CON
    current: number;
    temporary: number;
  };
  hitDice: {
    total: number; // Equal to level
    remaining: number;
    dieType: `d${6 | 8 | 10 | 12}` | null; // e.g., d10
  };
  equipment: EquipmentItem[]; // Array of equipment items
  // Explicit proficiencies (armor, weapons, tools, saves, initially from class/background)
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    savingThrows: string[]; // Stat names the character is proficient in
  };
  features: Feature[]; // Features from class and race (potentially including metadata for effects)
  backstory: string;
  appearance: string;
  createdAt?: Date; // Optional: Timestamp for creation
  updatedAt?: Date; // Optional: Timestamp for last update
  campaignId?: string; // Optional: ID of the campaign the character belongs to
}


// --- Feature Metadata Types ---

// Define specific effect types for features
type StatBonusMetadata = {
  effectType: 'statBonus';
  stats: Partial<Record<keyof Character['stats'], number>>; // e.g., { strength: 1, dexterity: 1 }
  condition?: string; // Optional condition text, e.g., "while wearing armor"
};

type ProficiencyGrantMetadata = {
  effectType: 'proficiencyGrant';
  type: 'armor' | 'weapon' | 'tool' | 'skill' | 'savingThrow';
  proficiencies: string[]; // List of specific proficiencies granted (e.g., ["Longsword", "Stealth"])
  choose?: number; // Optional: Number of choices allowed from the list
  options?: string[]; // Optional: List of options if 'choose' is present
  condition?: string;
};

type ACBonusMetadata = {
  effectType: 'acBonus';
  value: number;
  condition?: string; // e.g., "while not wearing heavy armor"
};

// Specific type for complex AC calculations like Unarmored Defense
type ACCalculationMetadata = {
    effectType: 'acCalculation';
    formula: string; // e.g., "10 + dexMod + conMod" (parsed during AC calculation)
    condition: string; // e.g., "not wearing armor", "not wearing armor and not wielding a shield"
};

type AdvantageGrantMetadata = {
    effectType: 'advantage';
    target: 'savingThrow' | 'skillCheck' | 'attackRoll'; // What kind of roll gets advantage
    condition: string; // e.g., "against being charmed", "on Dexterity (Stealth) checks"
};

type ResistanceGrantMetadata = {
    effectType: 'resistance';
    damageType: string; // e.g., "Poison", "Fire"
    condition?: string;
};

// Add more effect types as needed (e.g., SpeedBonus, SpecialAction, etc.)

// Union type for feature metadata
export type FeatureEffectMetadata =
  | StatBonusMetadata
  | ProficiencyGrantMetadata
  | ACBonusMetadata
  | ACCalculationMetadata // Added new type
  | AdvantageGrantMetadata
  | ResistanceGrantMetadata;
// | SpeedBonusMetadata
// | SpecialActionMetadata;


/**
* Represents a feature or trait gained by a character.
*/
export interface Feature {
  name: string;
  description: string;
  source: string; // e.g., "Human Race", "Fighter Class", "Feat: Tough"
  metadata?: FeatureEffectMetadata; // Optional metadata describing the game effect
  isActionable?: boolean; // Does this feature grant an action the player can take?
  maxUses?: number | null;
  usesResetOn?: 'short-rest' | 'long-rest' | 'daily' | null;
  currentUses?: number; // Managed in Character state if tracked
}


/**
 * Represents an item of equipment.
 */
export interface EquipmentItem {
    name: string;
    description?: string;
    quantity?: number;
    weight?: number;
    cost?: string;
    type?: 'Weapon' | 'Armor' | 'Adventuring Gear' | 'Tool' | 'Potion' | string;
    isEquipped?: boolean; // State managed within the Character object
    // Weapon specific
    weaponCategory?: string; // e.g., "Simple Melee", "Martial Ranged"
    damageDice?: string; // e.g., "1d8", "2d6"
    damageType?: string; // e.g., "Slashing", "Piercing"
    properties?: string[]; // e.g., ["Finesse", "Light", "Thrown (range 20/60)"]
    // Armor specific
    armorCategory?: 'Light' | 'Medium' | 'Heavy' | 'Shield';
    baseAC?: number;
    addDexModifier?: boolean;
    maxDexBonus?: number | null;
    strengthRequirement?: number | null;
    stealthDisadvantage?: boolean;
}

/**
 * Represents character Hit Points and Hit Dice state within the Character object.
 */
export interface HitPointsState {
    current: number;
    max: number;
    temporary: number;
}
export interface HitDiceState {
    remaining: number;
    total: number; // Usually equals level
    dieType: `d${6 | 8 | 10 | 12}` | null;
}

/**
 * Represents a character class in D&D 5e.
 */
export interface CharacterClass {
  name: string;
  description: string;
  hitDie: `d${6 | 8 | 10 | 12}`;
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools?: string[];
    savingThrows: string[]; // Stat names ('Strength', 'Dexterity', etc.)
    skills?: { choose: number; options: string[] }; // Skill choices provided by the class
  };
  featuresByLevel?: { // Optional: Detailed feature progression
      [level: number]: string[]; // Array of feature keys/names gained at this level
  };
  // features?: Feature[]; // Deprecated: Features should ideally be defined centrally or fetched dynamically
}

/**
 * Represents a character race in D&D 5e.
 */
export interface CharacterRace {
  name: string;
  description: string;
  traits?: string[]; // Names/Keys of traits/features granted by this race
  baseSpeed?: number; // e.g., 30, 25
  size?: string; // e.g., "Medium", "Small"
  // Stat bonuses can be represented by features with 'statBonus' metadata included in 'traits'
}

/**
 * Represents a character background in D&D 5e.
 */
export interface BackgroundInfo {
    name: string;
    description: string;
    skillProficiencies: string[];
    toolProficiencies?: string[];
    languages?: { choose: number; options?: string[] }; // e.g., choose 2 from list
    feature: { name: string; description: string }; // Core background feature
    equipment?: string[]; // List of starting equipment names/descriptions
    startingGold?: number;
    // Suggested personality traits are usually handled separately or embedded in description
    suggestedTraits?: string[];
    suggestedIdeals?: string[];
    suggestedBonds?: string[];
    suggestedFlaws?: string[];
}


/**
 * Represents a User in the application.
 */
 export type UserRole = 'player' | 'dm';
 export interface UserProfile {
   id: string; // Firebase Auth UID
   email?: string | null;
   displayName?: string | null;
   role: UserRole; // 'player' or 'dm'
   createdAt?: Date;
   updatedAt?: Date;
 }


 /**
  * Represents a Campaign.
  */
 export interface Campaign {
   id: string;
   name: string;
   description: string;
   dmId: string; // User ID of the Dungeon Master
   playerIds: string[]; // User IDs of the players
   characterIds: string[]; // Character IDs belonging to this campaign
   activeSourcePackIds?: string[]; // IDs of content packs enabled
   createdAt: Date;
   updatedAt: Date;
 }

 /**
  * Represents an entry in the game log.
  */
 export interface GameLogEntry {
    id: string;
    campaignId: string;
    timestamp: Date;
    actorId: string; // User ID or Character ID or 'system'
    actorName: string; // Display name of the actor
    actionType: 'roll' | 'featureUse' | 'message' | 'statusChange' | 'combatStart' | 'combatEnd' | 'turnChange' | 'initiativeRoll' | 'hpChange' | 'hpSet' | string; // Type of action
    details: string; // Description of the action
    rollDetails?: {
        dice: string;
        result: number;
        components?: { roll: number; modifier?: number };
    };
 }

/**
 * Represents a Monster stat block.
 */
export interface Monster {
  id?: string; // Added ID for internal tracking/dropdowns
  name: string;
  description?: string;
  size?: string;
  type?: string;
  alignment?: string;
  armorClass?: number;
  hitPoints?: {
    average: number;
    dice: string; // e.g., "10d8+20"
  };
  speed?: string; // e.g., "30 ft., fly 60 ft."
  stats?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills?: Record<string, number>; // Skill modifier (e.g., { Perception: 5 })
  senses?: string; // e.g., "darkvision 60 ft., passive Perception 15"
  languages?: string; // e.g., "Common, Goblin"
  challengeRating?: string; // e.g., "1/4", "5"
  specialAbilities?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string; attackBonus?: number; damageDice?: string; damageBonus?: number }>;
}

/**
 * Represents a Non-Player Character (NPC).
 */
 export interface NPC {
    id?: string;
    name: string;
    description?: string; // Physical description, role in the world
    personality?: string; // Traits, ideals, bonds, flaws
    notes?: string; // DM notes, plot hooks, relationships
    size?: string;
    type?: string; // e.g., Humanoid (Human), Beast
    alignment?: string;
    armorClass?: number;
    hitPoints?: {
        average: number;
        dice: string; // e.g., 2d8+2
    };
    speed?: string;
    stats?: {
        strength: number;
        dexterity: number;
        constitution: number;
        intelligence: number;
        wisdom: number;
        charisma: number;
    };
    skills?: Record<string, number>; // e.g., { Persuasion: 3, Insight: 2 }
    senses?: string;
    languages?: string;
    challengeRating?: string;
    actions?: Array<{ name: string; description: string; attackBonus?: number; damageDice?: string; damageBonus?: number }>;
 }


 /**
  * Represents a content source pack (e.g., SRD, custom DM content).
  */
 export interface SourcePack {
    id: string;
    name: string;
    description: string;
    creatorId: string; // 'system' or DM's user ID
    content: {
        races?: Record<string, CharacterRace>; // Store full race definition
        classes?: Record<string, CharacterClass>; // Store full class definition
        items?: Record<string, Omit<EquipmentItem, 'isEquipped'>>; // Store item definitions
        monsters?: Record<string, Omit<Monster, 'id'>>;
        npcs?: Record<string, Omit<NPC, 'id'>>;
        backgrounds?: Record<string, BackgroundInfo>; // Store full background info
        features?: Record<string, Omit<Feature, 'name' | 'source'>>; // Allow storing standalone features, keyed by name
    };
    createdAt: Date;
    updatedAt: Date;
 }


/**
 * Represents a participant in an encounter (character, monster, or NPC).
 */
export interface EncounterParticipant {
  id: string; // Unique ID for this instance in the encounter
  sourceId: string; // ID of the Character, Monster definition, or NPC definition
  type: 'character' | 'monster' | 'npc';
  name: string; // Character name, Monster name (e.g., "Goblin 1"), or NPC name
  initiative?: number | null;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  conditions?: string[]; // Array of condition names
}

/**
 * Represents a combat encounter.
 */
export interface Encounter {
  id: string; // Firestore document ID
  campaignId: string;
  name: string;
  description?: string;
  participants: EncounterParticipant[];
  status: 'setup' | 'running' | 'completed';
  currentTurnIndex?: number | null;
  round?: number;
  createdAt: Date;
  updatedAt: Date;
}

// --- Helper Functions ---

/**
 * Rolls dice based on a dice string (e.g., "1d20", "2d6+3").
 */
export const rollDice = (diceString: string): number => {
    if (!diceString || typeof diceString !== 'string' || !diceString.includes('d')) {
        console.error("Invalid dice string format:", diceString);
        return 0;
    }
    try {
        // Handle simple dice like 'd6', 'd20'
        if (diceString.startsWith('d')) {
            diceString = '1' + diceString;
        }
        // Handle simple +/- modifiers
        let modifier = 0;
        let dicePart = diceString;
        if (diceString.includes('+')) {
            const parts = diceString.split('+');
            dicePart = parts[0].trim();
            modifier = parseInt(parts.slice(1).join('+').trim(), 10) || 0;
        } else if (diceString.includes('-')) {
            const parts = diceString.split('-');
            dicePart = parts[0].trim();
            modifier = -(parseInt(parts.slice(1).join('-').trim(), 10) || 0);
        }

        const [numDiceStr, numSidesStr] = dicePart.toLowerCase().split('d');
        const numDice = parseInt(numDiceStr, 10);
        const numSides = parseInt(numSidesStr, 10);

        if (isNaN(numDice) || isNaN(numSides) || numDice <= 0 || numSides <= 0) {
            console.error("Invalid dice numbers in:", diceString);
            return 0;
        }

        let total = 0;
        for (let i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * numSides) + 1;
        }
        return total + modifier;
    } catch (e) {
        console.error("Error rolling dice:", diceString, e);
        return 0;
    }
};

// Skill to Ability Score mapping
export const SKILL_ABILITY_MAP: Record<string, keyof Character['stats']> = {
    "acrobatics": "dexterity",
    "animal handling": "wisdom",
    "arcana": "intelligence",
    "athletics": "strength",
    "deception": "charisma",
    "history": "intelligence",
    "insight": "wisdom",
    "intimidation": "charisma",
    "investigation": "intelligence",
    "medicine": "wisdom",
    "nature": "intelligence",
    "perception": "wisdom",
    "performance": "charisma",
    "persuasion": "charisma",
    "religion": "intelligence",
    "sleight of hand": "dexterity",
    "stealth": "dexterity",
    "survival": "wisdom"
};

// All standard 5e skills
export const ALL_SKILLS = Object.keys(SKILL_ABILITY_MAP);

/**
 * Calculates the modifier for a given skill.
 * Considers base ability score, proficiency bonus if applicable, and potential expertises (not yet implemented).
 */
export const calculateSkillModifier = (
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'] | undefined, // Use base stats
    proficient: boolean,
    proficiencyBonus: number
): number => {
    const skillLower = skillName.toLowerCase();
    const ability = SKILL_ABILITY_MAP[skillLower];

    if (!stats) {
        console.warn(`Stats object is missing for skill calculation: ${skillName}.`);
        return 0;
    }

    // Handle direct skill modifiers from monsters/NPCs if available (these override calculation)
     if ('skills' in stats && stats.skills && typeof stats.skills[skillLower] === 'number') {
       return stats.skills[skillLower] as number;
     }

    // Calculate based on ability score if skill override not present
     if (!ability || typeof stats[ability] !== 'number') {
        // Log only if the ability mapping itself is the issue
        if (!ability) {
             console.warn(`Could not find ability mapping for skill: ${skillName}.`);
        }
        // Don't warn if stats just aren't present for that ability (e.g., monster with low INT)
        return 0;
    }

    const abilityModifier = Math.floor((stats[ability]! - 10) / 2);
    const proficiencyValue = proficient ? proficiencyBonus : 0;
    // TODO: Add check for expertise (would double proficiencyValue)
    return abilityModifier + proficiencyValue;
};

/**
 * Interface defining the structure for a character level progression.
 * (Copied from dnd-api.ts for now, could be shared)
 */
export interface CharacterLevel {
    level: number;
    features: Feature[];
    proficiencyBonus?: number; // Optional: May not change every level
    // spellcasting?: { ... }; // Optional spellcasting details
    // Add other level-specific changes like ASI options
}
```