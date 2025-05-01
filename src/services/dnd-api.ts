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
   * A list of trait names that the race has.
   */
  traits: string[]; // Keep simple for now, detailed traits fetched separately
}

/**
* Represents a feature or trait gained by a character.
*/
export interface Feature {
  /**
   * The name of the feature or trait.
   */
  name: string;
  /**
   * A description of the feature or trait.
   */
  description: string;
  /**
   * The source of the feature (e.g., Class, Race, Feat).
   */
  source: string;
}


/**
 * Represents the details gained at a specific character level.
 */
export interface CharacterLevel {
  /**
   * The level achieved.
   */
  level: number;
  /**
   * The features gained specifically at this level.
   */
  features: Feature[];
   /**
    * The proficiency bonus at this level. (Optional, but useful)
    */
   proficiencyBonus?: number;
   /**
    * Details about spellcasting progression, if applicable. (Optional)
    */
   spellcasting?: Record<string, any>; // Placeholder for spell slot info
   // Add other level-specific details like class-specific resource increases (Ki, Sorcery Points, etc.) if needed
}


/**
 * Fetches available character classes from the D\&D 5e API.
 * @returns A promise that resolves to an array of character classes.
 */
export async function getCharacterClasses(): Promise<CharacterClass[]> {
  // TODO: Implement this by calling an API. Using placeholder data.
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
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
    {
      name: 'Rogue',
      description: 'Master of stealth and subtlety.',
      hitDie: 'd8',
    },
    {
      name: 'Cleric',
      description: 'Wielder of divine magic.',
      hitDie: 'd8',
    },
  ];
}

/**
 * Fetches available character races from the D\&D 5e API.
 * @returns A promise that resolves to an array of character races.
 */
export async function getCharacterRaces(): Promise<CharacterRace[]> {
  // TODO: Implement this by calling an API. Using placeholder data.
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
  return [
    {
      name: 'Human',
      description: 'Humans are the most common people in the worlds of D\&D, but they live nearly everywhere.',
      traits: ['Ability Score Increase', 'Extra Language'],
    },
    {
      name: 'Elf',
      description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
      traits: ['Darkvision', 'Fey Ancestry', 'Trance'],
    },
    {
      name: 'Dwarf',
      description: 'Resilient and sturdy.',
      traits: ['Darkvision', 'Dwarven Resilience', 'Stonecunning'],
    },
    {
      name: 'Halfling',
      description: 'Small and lucky.',
      traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
    },
  ];
}

/**
 * Fetches level up options for a specific character class and level from the D\&D 5e API.
 * This function simulates fetching ONLY the features gained AT the target level.
 * @param className The name of the character class.
 * @param targetLevel The level the character is advancing TO.
 * @returns A promise that resolves to the details for the target level.
 */
export async function getLevelUpOptions(className: string, targetLevel: number): Promise<CharacterLevel> {
  // TODO: Implement this by calling a real API based on className and targetLevel.
  // This is placeholder data simulating features gained *at* targetLevel.
  console.log(`Fetching level up options for ${className} to level ${targetLevel}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  let features: Feature[] = [];
  let proficiencyBonus: number | undefined = undefined;

  // Basic proficiency bonus progression
  if (targetLevel >= 1 && targetLevel <= 4) proficiencyBonus = 2;
  else if (targetLevel >= 5 && targetLevel <= 8) proficiencyBonus = 3;
  // ... and so on

  switch (className) {
    case 'Fighter':
      if (targetLevel === 1) {
        features = [
          { name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty (e.g., Archery, Dueling). Choose one.', source: 'Fighter Class' },
          { name: 'Second Wind', description: 'On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level.', source: 'Fighter Class' },
        ];
      } else if (targetLevel === 2) {
        features = [
          { name: 'Action Surge', description: 'On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.', source: 'Fighter Class' },
        ];
      } else if (targetLevel === 3) {
        features = [
          { name: 'Martial Archetype', description: 'You choose an archetype that you strive to emulate in your combat styles and techniques (e.g., Battle Master, Champion).', source: 'Fighter Class' },
          // Note: Specific archetype features would also be listed here in a real implementation.
        ];
      }
      // Add more levels...
      break;
    case 'Wizard':
       if (targetLevel === 1) {
         features = [
           { name: 'Spellcasting', description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and expectations.', source: 'Wizard Class' },
           { name: 'Arcane Recovery', description: 'You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover.', source: 'Wizard Class' },
         ];
       } else if (targetLevel === 2) {
         features = [
           { name: 'Arcane Tradition', description: 'You choose an arcane tradition, shaping your practice of magic (e.g., School of Evocation, School of Illusion).', source: 'Wizard Class' },
           // Note: Specific tradition features would also be listed here.
         ];
       }
       // Add more levels...
      break;
     // Add other classes...
    default:
      features = [{ name: `Placeholder Feature for ${className}`, description: `Feature gained at level ${targetLevel}.`, source: `${className} Class`}];
      break;
  }

  // Simulate an error for testing
  // if (className === 'Rogue' && targetLevel === 2) {
  //   throw new Error("Network error simulating API failure for Rogue level 2.");
  // }

  return {
    level: targetLevel,
    features: features,
    proficiencyBonus: proficiencyBonus,
    // Add spellcasting details if relevant for the class/level
  };
}


/**
 * Fetches detailed descriptions for a list of race trait names.
 * @param traitNames - An array of trait names to fetch details for.
 * @returns A promise that resolves to an array of Feature objects representing the traits.
 */
export async function getRaceTraitsDetails(traitNames: string[]): Promise<Feature[]> {
    // TODO: Implement this by calling a real API based on traitNames.
    // This is placeholder data.
    console.log(`Fetching details for traits: ${traitNames.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay

    const allTraitDetails: Record<string, Feature> = {
        'Ability Score Increase': { name: 'Ability Score Increase', description: 'Your ability scores each increase by 1.', source: 'Human Race' },
        'Extra Language': { name: 'Extra Language', description: 'You can speak, read, and write one extra language of your choice.', source: 'Human Race' },
        'Darkvision': { name: 'Darkvision', description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.', source: 'Elf/Dwarf Race' },
        'Fey Ancestry': { name: 'Fey Ancestry', description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.", source: 'Elf Race' },
        'Trance': { name: 'Trance', description: 'Elves don’t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.', source: 'Elf Race' },
        'Dwarven Resilience': { name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.', source: 'Dwarf Race' },
        'Stonecunning': { name: 'Stonecunning', description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.', source: 'Dwarf Race' },
        'Lucky': { name: 'Lucky', description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.', source: 'Halfling Race' },
        'Brave': { name: 'Brave', description: 'You have advantage on saving throws against being frightened.', source: 'Halfling Race' },
        'Halfling Nimbleness': { name: 'Halfling Nimbleness', description: 'You can move through the space of any creature that is of a size larger than yours.', source: 'Halfling Race' },
    };

    return traitNames
        .map(name => allTraitDetails[name])
        .filter((trait): trait is Feature => trait !== undefined); // Type guard to filter out undefined
}

/**
 * Fetches all cumulative class features up to a certain level.
 * This requires multiple calls to getLevelUpOptions (or a dedicated API endpoint).
 * @param className The name of the character class.
 * @param maxLevel The maximum level to fetch features for.
 * @returns A promise that resolves to an array of all features gained up to maxLevel.
 */
export async function getCumulativeClassFeatures(className: string, maxLevel: number): Promise<Feature[]> {
    let allFeatures: Feature[] = [];
    for (let level = 1; level <= maxLevel; level++) {
        try {
            const levelData = await getLevelUpOptions(className, level);
            allFeatures = allFeatures.concat(levelData.features);
        } catch (error) {
            console.error(`Error fetching features for ${className} level ${level}:`, error);
            // Decide how to handle partial failures - stop, continue, return partial?
            // For now, let's just log and continue.
        }
    }
    return allFeatures;
}
