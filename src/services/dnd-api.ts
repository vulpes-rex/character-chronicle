/**
 * Represents a character class in D\&D 5e.
 */
export interface CharacterClass {
  /**
   * The name of the class.
   */
  name: string;
  /**
   * A description of the class.
   */
  description: string;
  /**
   * Hit die type for the class (e.g., d8, d10).
   */
  hitDie: string;
}

/**
 * Represents a character race in D\&D 5e.
 */
export interface CharacterRace {
  /**
   * The name of the race.
   */
  name: string;
  /**
   * A description of the race.
   */
  description: string;
  /**
   * A list of traits that the race has.
   */
  traits: string[];
}

/**
 * Represents a character level.
 */
export interface CharacterLevel {
  /**
   * The level of the character.
   */
  level: number;
  /**
   * The features gained at this level.
   */
  features: string[];
}

/**
 * Fetches available character classes from the D\&D 5e API.
 * @returns A promise that resolves to an array of character classes.
 */
export async function getCharacterClasses(): Promise<CharacterClass[]> {
  // TODO: Implement this by calling an API.
  return [
    {
      name: 'Fighter',
      description: 'A master of martial combat, skilled with a variety of weapons and armor.',
      hitDie: 'd10',
    },
    {
      name: 'Wizard',
      description: 'A scholarly magic-user capable of manipulating the structures of reality.',
      hitDie: 'd6',
    },
  ];
}

/**
 * Fetches available character races from the D\&D 5e API.
 * @returns A promise that resolves to an array of character races.
 */
export async function getCharacterRaces(): Promise<CharacterRace[]> {
  // TODO: Implement this by calling an API.
  return [
    {
      name: 'Human',
      description: 'Humans are the most common people in the worlds of D\&D, but they live nearly everywhere.',
      traits: ['Adaptable', 'Diverse'],
    },
    {
      name: 'Elf',
      description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
      traits: ['Fey Ancestry', 'Trance'],
    },
  ];
}

/**
 * Fetches level up options for a character class from the D\&D 5e API.
 * @param className The name of the character class.
 * @param level The current level of the character.
 * @returns A promise that resolves to an array of level up options.
 */
export async function getLevelUpOptions(className: string, level: number): Promise<CharacterLevel> {
  // TODO: Implement this by calling an API.
  return {
    level: level + 1,
    features: ['New Feature 1', 'New Feature 2'],
  };
}
