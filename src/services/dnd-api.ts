
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
   * Hit die type for the class (e.g., d8, d10). String representation like 'd6', 'd8', 'd10', 'd12'.
   */
  hitDie: `d${6 | 8 | 10 | 12}`;
   /**
    * Proficiencies granted by the class.
    */
   proficiencies: {
     armor: string[]; // e.g., ['Light', 'Medium', 'Shields']
     weapons: string[]; // e.g., ['Simple', 'Martial']
     tools?: string[];
     savingThrows: string[]; // e.g., ['Strength', 'Constitution']
     skills?: { choose: number; options: string[] }; // e.g., { choose: 2, options: ['Acrobatics', 'Athletics', ...] }
   };
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
  /**
   * Indicates if this feature provides an actionable ability.
   */
  isActionable?: boolean; // Optional flag for features usable as actions
   /**
    * Maximum number of uses (optional, null/undefined means unlimited or not applicable).
    */
   maxUses?: number | null;
   /**
    * How uses are reset (e.g., short rest, long rest, daily).
    */
   usesResetOn?: 'short-rest' | 'long-rest' | 'daily' | null;
   /**
    * Current number of uses remaining (managed by character sheet state, not API directly usually).
    * Included here for type consistency if needed, but primarily a state concern.
    */
   currentUses?: number;
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
 * Represents an item of equipment.
 */
export interface EquipmentItem {
    /**
     * The name of the item.
     */
    name: string;
    /**
     * A description of the item (optional).
     */
    description?: string;
    /**
     * The quantity of the item (used in character sheet, may not be in base item data).
     */
    quantity?: number;
     /**
      * The weight of the item (optional).
      */
     weight?: number;
     /**
      * The cost of the item (optional).
      */
     cost?: string; // e.g., "5 gp", "1 sp"
     /**
      * The type of item (e.g., 'Weapon', 'Armor', 'Adventuring Gear').
      */
     type?: 'Weapon' | 'Armor' | 'Adventuring Gear' | 'Tool' | 'Potion' | string; // More specific types
     /**
      * Indicates if the item is currently equipped.
      */
     isEquipped?: boolean;
     /**
      * Category of the weapon (e.g., 'Simple Melee', 'Martial Ranged'). Relevant if type is 'Weapon'.
      */
     weaponCategory?: 'Simple Melee' | 'Simple Ranged' | 'Martial Melee' | 'Martial Ranged' | string;
     /**
      * Damage dice string (e.g., '1d8', '2d6'). Relevant if type is 'Weapon'.
      */
     damageDice?: string;
     /**
      * Type of damage dealt (e.g., 'Slashing', 'Piercing', 'Bludgeoning'). Relevant if type is 'Weapon'.
      */
     damageType?: string;
     /**
      * Weapon properties (e.g., ['Finesse', 'Light', 'Versatile (1d10)']). Relevant if type is 'Weapon'.
      */
     properties?: string[];
     /**
      * Category of the armor (e.g., 'Light', 'Medium', 'Heavy', 'Shield'). Relevant if type is 'Armor'.
      */
     armorCategory?: 'Light' | 'Medium' | 'Heavy' | 'Shield';
     /**
      * Base Armor Class provided by the armor. Relevant if type is 'Armor'.
      */
     baseAC?: number;
     /**
      * Whether the Dexterity modifier is added to AC. Relevant if type is 'Armor'.
      */
     addDexModifier?: boolean;
     /**
      * Maximum Dexterity bonus allowed for AC. Relevant for Medium Armor. Null means no limit.
      */
     maxDexBonus?: number | null;
     /**
      * Strength requirement to wear the armor without speed penalty. Relevant for Heavy Armor.
      */
     strengthRequirement?: number | null;
     /**
      * Whether wearing this armor imposes disadvantage on Stealth checks.
      */
     stealthDisadvantage?: boolean;
}

/**
 * Represents character Hit Points and Hit Dice.
 */
export interface HitPoints {
    /** Current Hit Points */
    current: number;
    /** Maximum Hit Points */
    max: number;
    /** Temporary Hit Points */
    temporary: number;
    /** Current available Hit Dice */
    currentHitDice: number;
    /** Maximum number of Hit Dice (usually equal to level) */
    maxHitDice: number;
    /** The type of hit die the character uses (e.g., d8) */
    hitDieType: `d${6 | 8 | 10 | 12}` | null;
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
      proficiencies: {
        armor: ['Light', 'Medium', 'Heavy', 'Shields'],
        weapons: ['Simple', 'Martial'],
        savingThrows: ['Strength', 'Constitution'],
        skills: { choose: 2, options: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
      },
    },
    {
      name: 'Wizard',
      description: 'A scholarly magic-user capable of manipulating the structures of reality.',
      hitDie: 'd6',
      proficiencies: {
        armor: [],
        weapons: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'], // Specific weapons
        savingThrows: ['Intelligence', 'Wisdom'],
        skills: { choose: 2, options: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
        tools: [],
      },
    },
    {
      name: 'Rogue',
      description: 'Master of stealth and subtlety.',
      hitDie: 'd8',
       proficiencies: {
         armor: ['Light'],
         weapons: ['Simple', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
         tools: ["Thieves' Tools"],
         savingThrows: ['Dexterity', 'Intelligence'],
         skills: { choose: 4, options: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
       },
    },
    {
      name: 'Cleric',
      description: 'Wielder of divine magic.',
      hitDie: 'd8',
       proficiencies: {
         armor: ['Light', 'Medium', 'Shields'],
         weapons: ['Simple'],
         savingThrows: ['Wisdom', 'Charisma'],
         skills: { choose: 2, options: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
         tools: [],
       },
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
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay (reduced for cumulative fetch)

  let features: Feature[] = [];
  let proficiencyBonus: number | undefined = undefined;

  // Basic proficiency bonus progression
  if (targetLevel >= 1 && targetLevel <= 4) proficiencyBonus = 2;
  else if (targetLevel >= 5 && targetLevel <= 8) proficiencyBonus = 3;
  else if (targetLevel >= 9 && targetLevel <= 12) proficiencyBonus = 4;
  else if (targetLevel >= 13 && targetLevel <= 16) proficiencyBonus = 5;
  else if (targetLevel >= 17 && targetLevel <= 20) proficiencyBonus = 6;


  switch (className) {
    case 'Fighter':
      if (targetLevel === 1) {
        features = [
          { name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty (e.g., Archery, Dueling). Choose one.', source: 'Fighter Class' },
          { name: 'Second Wind', description: 'On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.', source: 'Fighter Class', isActionable: true, maxUses: 1, usesResetOn: 'short-rest' }, // Add usage info
        ];
      } else if (targetLevel === 2) {
        features = [
          { name: 'Action Surge', description: 'On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.', source: 'Fighter Class', isActionable: true, maxUses: 1, usesResetOn: 'short-rest' }, // Add usage info (Reset can vary based on level)
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
           { name: 'Spellcasting', description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and expectations.', source: 'Wizard Class' }, // Not directly an action, but enables spell actions
           { name: 'Arcane Recovery', description: 'You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover.', source: 'Wizard Class', maxUses: 1, usesResetOn: 'long-rest' }, // Typically used during rest, once per long rest
         ];
       } else if (targetLevel === 2) {
         features = [
           { name: 'Arcane Tradition', description: 'You choose an arcane tradition, shaping your practice of magic (e.g., School of Evocation, School of Illusion).', source: 'Wizard Class' },
           // Note: Specific tradition features would also be listed here. Some might be actions.
         ];
       }
       // Add more levels...
      break;
     case 'Rogue':
        if (targetLevel === 1) {
            features = [
                { name: 'Expertise', description: 'Choose two of your skill proficiencies, or one skill proficiency and thieves\' tools proficiency. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.', source: 'Rogue Class' },
                { name: 'Sneak Attack', description: 'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. You don\'t need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn\'t incapacitated, and you don\'t have disadvantage on the attack roll. The amount of the extra damage increases as you gain levels in this class.', source: 'Rogue Class' }, // This modifies attacks, not a separate action itself
                { name: 'Thieves\' Cant', description: 'You learn thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.', source: 'Rogue Class' },
            ];
        } else if (targetLevel === 2) {
            features = [
                { name: 'Cunning Action', description: 'Your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.', source: 'Rogue Class', isActionable: true }, // Provides bonus actions, no "uses"
            ];
        }
        // Add more levels...
       break;
    case 'Cleric':
        if (targetLevel === 1) {
            features = [
                { name: 'Spellcasting', description: 'As a conduit for divine power, you can cast cleric spells.', source: 'Cleric Class' },
                { name: 'Divine Domain', description: 'Choose one domain related to your deity (e.g., Life, Knowledge, War). Your choice grants you domain spells and other features.', source: 'Cleric Class' },
                // Note: Specific domain features (like heavy armor proficiency for War) would be listed here. Some might be actions (like Channel Divinity options).
            ];
        } else if (targetLevel === 2) {
            features = [
                 { name: 'Channel Divinity', description: 'You gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. Some domains grant you additional effects as you advance in levels. When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again.', source: 'Cleric Class', isActionable: true, maxUses: 1, usesResetOn: 'short-rest' }, // Combined description, usage tied to the overall feature
                 // Individual effects like Turn Undead aren't separate use-limited features, they consume the main Channel Divinity use.
            ];
        }
        // Add more levels...
       break;
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
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay

    // Mark some traits as potentially actionable if they grant specific actions/abilities
    const allTraitDetails: Record<string, Feature> = {
        'Ability Score Increase': { name: 'Ability Score Increase', description: 'Your ability scores each increase by 1.', source: 'Human Race' },
        'Extra Language': { name: 'Extra Language', description: 'You can speak, read, and write one extra language of your choice.', source: 'Human Race' },
        'Darkvision': { name: 'Darkvision', description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.', source: 'Elf/Dwarf Race' }, // Passive ability
        'Fey Ancestry': { name: 'Fey Ancestry', description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.", source: 'Elf Race' }, // Passive resistance
        'Trance': { name: 'Trance', description: 'Elves don’t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.', source: 'Elf Race' }, // Affects rest
        'Dwarven Resilience': { name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.', source: 'Dwarf Race' }, // Passive resistance
        'Stonecunning': { name: 'Stonecunning', description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.', source: 'Dwarf Race' }, // Affects skill checks
        'Lucky': { name: 'Lucky', description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.', source: 'Halfling Race', isActionable: true, maxUses: null, usesResetOn: null }, // Actionable, but uses are situational/reaction based, not tracked numerically like class features. Set maxUses/usesResetOn to null.
        'Brave': { name: 'Brave', description: 'You have advantage on saving throws against being frightened.', source: 'Halfling Race' }, // Passive resistance
        'Halfling Nimbleness': { name: 'Halfling Nimbleness', description: 'You can move through the space of any creature that is of a size larger than yours.', source: 'Halfling Race' }, // Affects movement
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
    if (!className || maxLevel < 1) return []; // Guard clause

    // Use Promise.all for potentially faster fetching if the API supports concurrent requests
    const levelPromises: Promise<CharacterLevel>[] = [];
    for (let level = 1; level <= maxLevel; level++) {
        levelPromises.push(getLevelUpOptions(className, level));
    }

    try {
        const levelResults = await Promise.all(levelPromises);
        levelResults.forEach(levelData => {
            allFeatures = allFeatures.concat(levelData.features);
        });
    } catch (error) {
        console.error(`Error fetching cumulative features for ${className} up to level ${maxLevel}:`, error);
        // Handle the error appropriately - maybe return partial data or throw
        throw new Error(`Failed to fetch all features for ${className}.`);
    }

    return allFeatures;
}

/**
 * Fetches a list of available equipment items from the database/API.
 * @returns A promise that resolves to an array of EquipmentItem objects.
 */
export async function getAvailableEquipmentItems(): Promise<EquipmentItem[]> {
  // TODO: Implement this by calling a real API or database. Using placeholder data.
  console.log('Fetching available equipment items...');
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay

  return [
    { name: 'Backpack', description: 'Holds adventuring gear', weight: 5, cost: '2 gp', type: 'Adventuring Gear' },
    { name: 'Bedroll', description: 'For sleeping', weight: 7, cost: '1 gp', type: 'Adventuring Gear' },
    { name: 'Rope (50 feet)', description: 'Hempen rope', weight: 10, cost: '1 gp', type: 'Adventuring Gear' },
    { name: 'Torch', description: 'Provides light', weight: 1, cost: '1 cp', type: 'Adventuring Gear' },
    { name: 'Rations (1 day)', description: 'Food for one day', weight: 2, cost: '5 sp', type: 'Adventuring Gear' },
    { name: 'Waterskin', description: 'Holds water (4 pints)', weight: 5, cost: '2 sp', type: 'Adventuring Gear' },
    { name: 'Longsword', description: 'Versatile martial weapon', weight: 3, cost: '15 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile (1d10)'] },
    { name: 'Dagger', description: 'Simple melee weapon', weight: 1, cost: '2 gp', type: 'Weapon', weaponCategory: 'Simple Melee', damageDice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Light', 'Thrown (range 20/60)'] },
    { name: 'Shortsword', description: 'Simple melee weapon', weight: 2, cost: '10 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d6', damageType: 'Piercing', properties: ['Finesse', 'Light'] },
    { name: 'Rapier', description: 'Martial melee weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Piercing', properties: ['Finesse'] },
    { name: 'Shortbow', description: 'Simple ranged weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d6', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Two-Handed'] },
    { name: 'Light Crossbow', description: 'Simple ranged weapon', weight: 5, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d8', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Loading', 'Two-Handed'] },
    { name: 'Leather Armor', description: 'Light armor', weight: 10, cost: '10 gp', type: 'Armor', armorCategory: 'Light', baseAC: 11, addDexModifier: true, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false },
    { name: 'Scale Mail', description: 'Medium armor', weight: 45, cost: '50 gp', type: 'Armor', armorCategory: 'Medium', baseAC: 14, addDexModifier: true, maxDexBonus: 2, strengthRequirement: null, stealthDisadvantage: true },
    { name: 'Chain Mail', description: 'Heavy armor', weight: 55, cost: '75 gp', type: 'Armor', armorCategory: 'Heavy', baseAC: 16, addDexModifier: false, maxDexBonus: null, strengthRequirement: 13, stealthDisadvantage: true },
    { name: 'Shield', description: 'Increases AC by 2', weight: 6, cost: '10 gp', type: 'Armor', armorCategory: 'Shield', baseAC: 2, addDexModifier: false, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false }, // Shield gives a bonus, not base AC
    { name: 'Healing Potion', description: 'Regain 2d4+2 hit points', weight: 0.5, cost: '50 gp', type: 'Potion' },
    { name: 'Thieves\' Tools', description: 'Tools for disarming traps and opening locks', weight: 1, cost: '25 gp', type: 'Tool' },
  ].sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
}

    