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

// Helper function for dice rolling (moved here for potential server-side use)
export const rollDice = (diceString: string): number => {
    if (!diceString || !diceString.includes('d')) return 0;
    try {
        const [numDiceStr, numSidesStr] = diceString.toLowerCase().split('d');
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
        return total;
    } catch (e) {
        console.error("Error rolling dice:", diceString, e);
        return 0;
    }
};
