/**
 * Represents the core data structure for a D&D character.
 */
export interface Character {
  id: string; // Unique identifier (e.g., Firestore document ID)
  playerName: string;
  characterName: string;
  race: string; // Name of the race (e.g., "Human", "Elf")
  class: string; // Name of the class (e.g., "Fighter", "Wizard")
  level: number;
  background: string;
  alignment: string;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: Record<string, boolean>; // Map skill name to proficiency status
  hitPoints: {
    max: number;
    current: number;
    temporary: number;
  };
  hitDice: {
    total: number; // Equal to level
    remaining: number;
    dieType: `d${6 | 8 | 10 | 12}` | null; // e.g., d10
  };
  equipment: EquipmentItem[]; // Array of equipment items
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    savingThrows: string[]; // Stat names the character is proficient in
    // skills are derived from the skills object above
  };
  features: Feature[]; // Features from class and race
  backstory: string;
  appearance: string;
  createdAt?: Date; // Optional: Timestamp for creation
  updatedAt?: Date; // Optional: Timestamp for last update
  campaignId?: string; // Optional: ID of the campaign the character belongs to
}

/**
* Represents a feature or trait gained by a character.
* (Copied from dnd-api.ts for now, could be shared)
*/
export interface Feature {
  name: string;
  description: string;
  source: string;
  isActionable?: boolean;
  maxUses?: number | null;
  usesResetOn?: 'short-rest' | 'long-rest' | 'daily' | null;
  currentUses?: number; // This will be managed in the Character object state if tracked
}


/**
 * Represents an item of equipment.
 * (Copied from dnd-api.ts for now, could be shared)
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
    weaponCategory?: string;
    damageDice?: string;
    damageType?: string;
    properties?: string[];
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
 * (Simplified from dnd-api.ts for database storage)
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
 * (Copied from dnd-api.ts for now, could be shared)
 */
export interface CharacterClass {
  name: string;
  description: string;
  hitDie: `d${6 | 8 | 10 | 12}`;
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools?: string[];
    savingThrows: string[];
    skills?: { choose: number; options: string[] }; // Skill choices provided by the class
  };
}

/**
 * Represents a character race in D&D 5e.
 * (Copied from dnd-api.ts for now, could be shared)
 */
export interface CharacterRace {
  name: string;
  description: string;
  traits: string[]; // Names of traits
  // Potentially add skill proficiencies granted by race here if needed
  // skillProficiencies?: string[];
}

/**
 * Represents a character background in D&D 5e.
 * (Simplified for now)
 */
export interface BackgroundInfo {
    name: string;
    skillProficiencies: string[];
    toolProficiencies?: string[];
    // Add languages, equipment, features if needed
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
   // Add any other user-specific data needed
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
    actorId: string; // User ID or Character ID
    actorName: string; // Display name of the actor
    actionType: 'roll' | 'featureUse' | 'message' | 'statusChange' | string; // Type of action
    details: string; // Description of the action (e.g., "Rolled Athletics (1d20+3): 15", "Used Second Wind", "DM: A goblin appears!")
    rollDetails?: { // Optional specific details for dice rolls
        dice: string; // e.g., "1d20", "2d6+2"
        result: number;
        components?: { roll: number; modifier?: number }; // Breakdown if needed
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
    dice: string;
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
  skills?: Record<string, number>; // Skill modifier (e.g., { Perception: 5 })
  senses?: string;
  languages?: string;
  challengeRating?: string; // e.g., "1/4", "5"
  specialAbilities?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string; attackBonus?: number; damageDice?: string; damageBonus?: number }>;
}

/**
 * Represents a Non-Player Character (NPC).
 */
 export interface NPC {
    id?: string; // Added ID for internal tracking/dropdowns
    name: string;
    description?: string; // Physical description, role in the world
    personality?: string; // Traits, ideals, bonds, flaws
    notes?: string; // DM notes, plot hooks, relationships
    // Optional: Include stat block similar to Monster if they can enter combat
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
    challengeRating?: string; // If applicable
    actions?: Array<{ name: string; description: string; attackBonus?: number; damageDice?: string; damageBonus?: number }>; // Simple actions/attacks
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
        races?: Record<string, Omit<CharacterRace, 'description'>>; // Simplified for storage example
        classes?: Record<string, Omit<CharacterClass, 'description'>>;
        items?: Record<string, Omit<EquipmentItem, 'description' | 'isEquipped'>>;
        monsters?: Record<string, Omit<Monster, 'id'>>; // Omit internal ID for storage
        npcs?: Record<string, Omit<NPC, 'id'>>; // Added NPCs, omit internal ID
        backgrounds?: Record<string, BackgroundInfo>;
        // spells?: Record<string, any>; // Add spell structure if needed
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
  type: 'character' | 'monster' | 'npc'; // Added NPC type
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
  currentTurnIndex?: number | null; // Index in the participants array after sorting by initiative
  round?: number;
  createdAt: Date;
  updatedAt: Date;
}


// Helper function for dice rolling (moved here for potential server-side use)
export const rollDice = (diceString: string): number => {
    if (!diceString || !diceString.includes('d')) return 0;
    try {
        // Handle simple dice like 'd6', 'd20'
        if (diceString.startsWith('d')) {
            diceString = '1' + diceString;
        }
        // Handle simple +/- modifiers
        let modifier = 0;
        let dicePart = diceString;
        if (diceString.includes('+')) {
            [dicePart, modifier] = diceString.split('+').map(s => s.trim());
            modifier = parseInt(modifier, 10) || 0;
        } else if (diceString.includes('-')) {
            const parts = diceString.split('-');
            dicePart = parts[0].trim();
            // Join remaining parts in case of multiple hyphens (unlikely but possible)
            modifier = -(parseInt(parts.slice(1).join('-').trim(), 10) || 0);
        }


        const [numDiceStr, numSidesStr] = dicePart.toLowerCase().split('d');
        const numDice = parseInt(numDiceStr, 10);
        const numSides = parseInt(numSidesStr, 10);

        if (isNaN(numDice) || isNaN(numSides) || numDice <= 0 || numSides <= 0) {
            console.error("Invalid dice string:", diceString);
            return 0;
        }

        let total = 0;
        for (let i = 0; i < numDice; i++) {
            total += Math.floor(Math.random() * numSides) + 1;
        }
        return total + modifier; // Add modifier at the end
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

// Function to calculate skill modifier
export const calculateSkillModifier = (
    skillName: string,
    stats: Character['stats'] | NPC['stats'] | Monster['stats'], // Accept different stat blocks
    proficient: boolean,
    proficiencyBonus: number
): number => {
    const skillLower = skillName.toLowerCase();
    const ability = SKILL_ABILITY_MAP[skillLower];
    if (!ability || !stats?.[ability]) {
        console.warn(`Could not find ability score for skill: ${skillName}`);
        // Handle Monster skill overrides (e.g., { Perception: 5 })
         if (typeof (stats as Monster['stats'])?.[skillLower as keyof Monster['stats']] === 'number') {
             return (stats as Monster['stats'])[skillLower as keyof Monster['stats']] as number;
         }
        return 0;
    }
    const abilityModifier = Math.floor((stats[ability]! - 10) / 2);
    const proficiencyValue = proficient ? proficiencyBonus : 0;
    return abilityModifier + proficiencyValue;
};