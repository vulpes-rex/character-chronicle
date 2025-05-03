
/**
 * @fileOverview Defines the base SRD (System Reference Document) content pack.
 * This data acts as the fallback for core D&D 5e rules if no other source packs provide them.
 */

import type { SourcePack, Feature, Spell } from '@character-chronicle/shared/types'; // Use shared library path
import { ALL_SKILLS } from '@character-chronicle/shared/types'; // Use shared library path

// Define SRD features here for easier management
const SRD_FEATURES: Record<string, Omit<Feature, 'name' | 'source'>> = {
    // Race Features
    "HumanASI": {
        description: "Your ability scores each increase by 1.",
        metadata: {
            effectType: "statBonus",
            stats: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
        }
    },
    "ExtraLanguage": {
        description: "You can speak, read, and write one extra language of your choice.",
        metadata: {
            effectType: "proficiencyGrant",
            type: "language",
            choose: 1,
            options: ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"],
            choiceKey: "ExtraLanguage",
        }
    },
    "Darkvision": {
        description: "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.",
    },
    "FeyAncestry": {
        description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being charmed",
        }
    },
    "Trance": {
        description: "Elves don’t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.",
    },
    "DwarvenResilience": {
        description: "You have advantage on saving throws against poison, and you have resistance against poison damage.",
        metadata: {
            effectType: "resistance",
            damageType: "Poison",
        }
        // Advantage vs Poison Saving Throws needs specific implementation if required beyond resistance
    },
    "Stonecunning": {
        description: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.",
        // Note: Expertise effect needs specific handling during skill check calculation.
    },
    "Lucky": {
        description: "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
        isActionable: true, // Passive reaction
        maxUses: null,
        usesResetOn: null,
    },
    "Brave": {
        description: "You have advantage on saving throws against being frightened.",
        metadata: {
            effectType: "advantage",
            target: "savingThrow",
            condition: "against being frightened",
        }
    },
    "HalflingNimbleness": {
        description: "You can move through the space of any creature that is of a size larger than yours.",
    },

    // Class Features (Definitions)
     "FightingStyle": {
        description: "You adopt a particular style of fighting as your specialty. Choose one option.",
        metadata: {
            effectType: "choiceGrant",
            choose: 1,
            options: ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting"],
            choiceKey: "Fighting Style",
        }
    },
    "Fighting Style: Archery": {
        description: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
        metadata: { effectType: 'attackBonus', value: 2, condition: 'ranged weapon' } // Needs logic in roll calculation
    },
     "Fighting Style: Defense": {
        description: "While you are wearing armor, you gain a +1 bonus to AC.",
        metadata: {
            effectType: "acBonus",
            value: 1,
            condition: "wearing armor",
        },
    },
    "Fighting Style: Dueling": {
        description: "When wielding a melee weapon in one hand and no other weapons, gain a +2 bonus to damage rolls with that weapon.",
         metadata: { effectType: 'damageBonus', value: 2, condition: 'wielding melee weapon in one hand and no other weapon' } // Needs logic in damage roll
    },
     "Fighting Style: Great Weapon Fighting": {
        description: "When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.",
        // Metadata: Effect is situational, handled during damage roll logic
    },
     "Fighting Style: Protection": {
        description: "When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.",
        isActionable: true, // Reaction
        // Metadata: Effect is situational, handled manually or by combat tracker
    },
     "Fighting Style: Two-Weapon Fighting": {
        description: "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.",
        // Metadata: Effect is situational, handled during off-hand attack damage roll
    },
    "SecondWind": {
        description: "On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'short-rest',
    },
    "ActionSurge": {
        description: "On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'short-rest',
    },
     "Expertise": {
        description: "Choose two skill proficiencies, or one skill/tool proficiency. Double proficiency bonus for checks using chosen proficiencies.",
         metadata: {
             effectType: "proficiencyGrant", // Changed to proficiency grant
             type: 'skill', // Primary type is skill
             choose: 2, // Choose 2 skills OR 1 skill + 1 tool
             options: [...ALL_SKILLS, "Thieves' Tools", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools", "Poisoner's Kit"], // Example tools, needs full list
             choiceKey: "Expertise",
             // Note: Doubling proficiency bonus needs specific logic during skill check calculation based on choices.
             // The 'proficiencyGrant' here primarily handles making the *choice*.
         }
    },
    "SneakAttack": {
        description: "Once per turn, you can deal extra damage (scales with level) to one creature you hit with an attack under certain conditions.",
         // Metadata: Damage scales, effect is conditional. Handled in damage calculation logic.
    },
     "ThievesCant": {
        description: "A secret mix of dialect, jargon, and code allowing hidden messages.",
         metadata: { effectType: "proficiencyGrant", type: "language", proficiencies: ["Thieves' Cant"] }
    },
     "CunningAction": {
        description: "Use a bonus action to take the Dash, Disengage, or Hide action.",
        isActionable: true,
    },
    "Spellcasting": {
        description: "You have learned to draw on divine magic through meditation and prayer to cast spells.", // Generic description
        metadata: {
             effectType: 'spellcastingGrant', // Placeholder - specific ability/list defined in class
             ability: 'intelligence', // Default, overridden by class
         }
    },
    "ArcaneRecovery": {
        description: "You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover.",
        isActionable: true,
        maxUses: 1,
        usesResetOn: 'long-rest',
    },
     "ArcaneTradition": {
        description: "At 2nd level, you choose an arcane tradition, shaping your practice of magic.",
         metadata: {
             effectType: "choiceGrant",
             choose: 1,
             options: ["School of Abjuration", "School of Conjuration", "School of Divination", "School of Enchantment", "School of Evocation", "School of Illusion", "School of Necromancy", "School of Transmutation"], // SRD schools
             choiceKey: "Arcane Tradition",
         }
    },
    "UnarmoredDefenseBarbarian": {
        description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
        metadata: {
            effectType: 'acCalculation',
            formula: '10 + dexMod + conMod',
            condition: 'not wearing armor',
        },
    },
    "UnarmoredDefenseMonk": {
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        metadata: {
            effectType: 'acCalculation',
            formula: '10 + dexMod + wisMod',
            condition: 'not wearing armor and not wielding a shield',
        },
    },
    // Base Background Feature Examples
    "Shelter of the Faithful": {
        description: "As an acolyte, you command the respect of those who share your faith...",
    },
     "City Secrets": {
        description: "You know the secret patterns and flow of cities...",
    },
    "Military Rank": {
        description: "You have a military rank from your career as a soldier...",
    },
};

// Define SRD Spells
const SRD_SPELLS: Record<string, Omit<Spell, 'name'>> = {
     // Cantrips (Level 0)
    "Acid Splash": {
        description: "You hurl a bubble of acid. Choose one creature within range, or choose two creatures within range that are within 5 feet of each other...",
        level: 0, school: "Conjuration", castingTime: "1 action", range: "60 feet",
        components: ["V", "S"], duration: "Instantaneous", classes: ["Sorcerer", "Wizard"],
        saveRequired: "dexterity", damageDice: "1d6", damageType: "Acid", // Scales with level
    },
    "Light": {
        description: "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius...",
        level: 0, school: "Evocation", castingTime: "1 action", range: "Touch",
        components: ["V", "M (a firefly or phosphorescent moss)"], duration: "1 hour", classes: ["Bard", "Cleric", "Sorcerer", "Wizard"],
    },
    "Mage Hand": {
        description: "A spectral, floating hand appears at a point you choose within range...",
        level: 0, school: "Conjuration", castingTime: "1 action", range: "30 feet",
        components: ["V", "S"], duration: "1 minute", classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    },
    "Prestidigitation": {
        description: "This spell is a minor magical trick that novice spellcasters use for practice...",
        level: 0, school: "Transmutation", castingTime: "1 action", range: "10 feet",
        components: ["V", "S"], duration: "Up to 1 hour", classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
    },
     // Level 1 Spells
     "Burning Hands": {
        description: "As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth...",
        level: 1, school: "Evocation", castingTime: "1 action", range: "Self (15-foot cone)",
        components: ["V", "S"], duration: "Instantaneous", classes: ["Sorcerer", "Wizard"],
        saveRequired: "dexterity", damageDice: "3d6", damageType: "Fire",
        higherLevel: "When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.",
    },
    "Cure Wounds": {
        description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.",
        level: 1, school: "Evocation", castingTime: "1 action", range: "Touch",
        components: ["V", "S"], duration: "Instantaneous", classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"],
        healingDice: "1d8", // Modifier added separately
        higherLevel: "When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.",
    },
    "Magic Missile": {
        description: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range...",
        level: 1, school: "Evocation", castingTime: "1 action", range: "120 feet",
        components: ["V", "S"], duration: "Instantaneous", classes: ["Sorcerer", "Wizard"],
        damageDice: "1d4+1", damageType: "Force", // Deals 1d4+1 per missile
        // Note: Special targeting rules, each missile hits automatically.
        higherLevel: "When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.",
    },
     "Shield": {
        description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC...",
        level: 1, school: "Abjuration", castingTime: "1 reaction (when hit by attack or targeted by magic missile)", range: "Self",
        components: ["V", "S"], duration: "1 round", classes: ["Sorcerer", "Wizard"],
    },
     // Add many more SRD spells...
};


// Assign source property to all features
Object.keys(SRD_FEATURES).forEach(key => {
    // Basic heuristic for source, needs refinement
    let source = "SRD";
    if (key.includes("Human") || key.includes("Language")) source = "Human";
    else if (key.includes("Elf") || key.includes("Fey") || key.includes("Trance")) source = "Elf";
    else if (key.includes("Dwarven") || key.includes("Stonecunning")) source = "Dwarf";
    else if (key.includes("Halfling") || key.includes("Lucky") || key.includes("Brave")) source = "Halfling";
    else if (key.includes("FightingStyle") || key.includes("SecondWind") || key.includes("ActionSurge")) source = "Fighter";
    else if (key.includes("Expertise") || key.includes("SneakAttack") || key.includes("ThievesCant") || key.includes("CunningAction")) source = "Rogue";
    else if (key.includes("Spellcasting") || key.includes("ArcaneRecovery") || key.includes("ArcaneTradition")) source = "Wizard";
     else if (key.includes("UnarmoredDefenseBarbarian")) source = "Barbarian";
     else if (key.includes("UnarmoredDefenseMonk")) source = "Monk";
     else if (key.includes("ShelterOfTheFaithful")) source = "Acolyte Background"; // Corrected key name
     else if (key.includes("CitySecrets")) source = "Urchin Background";
     else if (key.includes("MilitaryRank")) source = "Soldier Background";

    (SRD_FEATURES as any)[key].source = source;
});


export const SRD_SOURCE_PACK: SourcePack = {
    id: "srd",
    name: "System Reference Document (SRD)",
    description: "Core rules and content from the D&D 5th Edition SRD.",
    creatorId: "system",
    createdAt: new Date(0), // Epoch date for system pack
    updatedAt: new Date(0),
    content: {
        races: {
            "Human": {
                name: 'Human',
                description: 'Humans are the most common people in the worlds of D&D, but they live nearly everywhere.',
                traits: ['HumanASI', 'ExtraLanguage'], // Feature keys
                baseSpeed: 30,
                size: "Medium",
            },
            "Elf": {
                name: 'Elf',
                description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
                traits: ['Darkvision', 'FeyAncestry', 'Trance'],
                baseSpeed: 30,
                size: "Medium",
            },
            "Dwarf": {
                name: 'Dwarf',
                description: 'Resilient and sturdy.',
                traits: ['Darkvision', 'DwarvenResilience', 'Stonecunning'],
                 baseSpeed: 25,
                 size: "Medium",
            },
             "Halfling": {
                name: 'Halfling',
                description: 'Small and lucky.',
                traits: ['Lucky', 'Brave', 'HalflingNimbleness'],
                 baseSpeed: 25,
                 size: "Small",
             },
        },
        classes: {
             "Fighter": {
                name: 'Fighter',
                description: 'A master of martial combat, skilled with a variety of weapons and armor.',
                hitDie: 'd10',
                proficiencies: {
                    armor: ['Light', 'Medium', 'Heavy', 'Shields'],
                    weapons: ['Simple', 'Martial'],
                    savingThrows: ['Strength', 'Constitution'],
                    skills: { choose: 2, options: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
                },
                 featuresByLevel: {
                    1: ['FightingStyle', 'SecondWind'],
                    2: ['ActionSurge'],
                    // Add more levels/features as needed
                 },
                 spellcastingAbility: null,
                 spellProgression: 'none',
            },
             "Wizard": {
                name: 'Wizard',
                description: 'A scholarly magic-user capable of manipulating the structures of reality.',
                hitDie: 'd6',
                proficiencies: {
                    armor: [],
                    weapons: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
                    savingThrows: ['Intelligence', 'Wisdom'],
                    skills: { choose: 2, options: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
                    tools: [],
                },
                  featuresByLevel: {
                    1: ['Spellcasting', 'ArcaneRecovery'],
                    2: ['ArcaneTradition'],
                    // ...
                 },
                 spellcastingAbility: 'intelligence',
                 spellProgression: 'full',
            },
             "Rogue": {
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
                 featuresByLevel: {
                    1: ['Expertise', 'SneakAttack', 'ThievesCant'],
                    2: ['CunningAction'],
                     // ...
                 },
                 spellcastingAbility: null,
                 spellProgression: 'none',
            },
             "Barbarian": { // Added Barbarian
                name: 'Barbarian',
                description: 'A fierce warrior who can enter a battle rage.',
                hitDie: 'd12',
                proficiencies: {
                    armor: ['Light', 'Medium', 'Shields'],
                    weapons: ['Simple', 'Martial'],
                    savingThrows: ['Strength', 'Constitution'],
                    skills: { choose: 2, options: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
                },
                featuresByLevel: {
                    1: ['Rage', 'UnarmoredDefenseBarbarian'],
                    // ...
                },
                 spellcastingAbility: null,
                 spellProgression: 'none',
             },
              "Monk": { // Added Monk
                 name: 'Monk',
                 description: 'A master of martial arts, harnessing the power of the body.',
                 hitDie: 'd8',
                 proficiencies: {
                     armor: [],
                     weapons: ['Simple', 'Shortswords'],
                     tools: ['One type of artisan\'s tools or one musical instrument'],
                     savingThrows: ['Strength', 'Dexterity'],
                     skills: { choose: 2, options: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
                 },
                 featuresByLevel: {
                     1: ['UnarmoredDefenseMonk', 'MartialArts'],
                     // ...
                 },
                  spellcastingAbility: null,
                  spellProgression: 'none',
              },
        },
        items: {
            "Backpack": { name: 'Backpack', description: 'Holds adventuring gear', weight: 5, cost: '2 gp', type: 'Adventuring Gear' },
            "Bedroll": { name: 'Bedroll', description: 'For sleeping', weight: 7, cost: '1 gp', type: 'Adventuring Gear' },
            "Rope (50 feet)": { name: 'Rope (50 feet)', description: 'Hempen rope', weight: 10, cost: '1 gp', type: 'Adventuring Gear' },
            "Torch": { name: 'Torch', description: 'Provides light', weight: 1, cost: '1 cp', type: 'Adventuring Gear' },
            "Rations (1 day)": { name: 'Rations (1 day)', description: 'Food for one day', weight: 2, cost: '5 sp', type: 'Adventuring Gear' },
            "Waterskin": { name: 'Waterskin', description: 'Holds water (4 pints)', weight: 5, cost: '2 sp', type: 'Adventuring Gear' },
            "Longsword": { name: 'Longsword', description: 'Versatile martial weapon', weight: 3, cost: '15 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile (1d10)'] },
            "Dagger": { name: 'Dagger', description: 'Simple melee weapon', weight: 1, cost: '2 gp', type: 'Weapon', weaponCategory: 'Simple Melee', damageDice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Light', 'Thrown (range 20/60)'] },
            "Shortsword": { name: 'Shortsword', description: 'Simple melee weapon', weight: 2, cost: '10 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d6', damageType: 'Piercing', properties: ['Finesse', 'Light'] },
            "Rapier": { name: 'Rapier', description: 'Martial melee weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Martial Melee', damageDice: '1d8', damageType: 'Piercing', properties: ['Finesse'] },
            "Shortbow": { name: 'Shortbow', description: 'Simple ranged weapon', weight: 2, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d6', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Two-Handed'] },
            "Light Crossbow": { name: 'Light Crossbow', description: 'Simple ranged weapon', weight: 5, cost: '25 gp', type: 'Weapon', weaponCategory: 'Simple Ranged', damageDice: '1d8', damageType: 'Piercing', properties: ['Ammunition (range 80/320)', 'Loading', 'Two-Handed'] },
            "Leather Armor": { name: 'Leather Armor', description: 'Light armor', weight: 10, cost: '10 gp', type: 'Armor', armorCategory: 'Light', baseAC: 11, addDexModifier: true, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false },
            "Scale Mail": { name: 'Scale Mail', description: 'Medium armor', weight: 45, cost: '50 gp', type: 'Armor', armorCategory: 'Medium', baseAC: 14, addDexModifier: true, maxDexBonus: 2, strengthRequirement: null, stealthDisadvantage: true },
            "Chain Mail": { name: 'Chain Mail', description: 'Heavy armor', weight: 55, cost: '75 gp', type: 'Armor', armorCategory: 'Heavy', baseAC: 16, addDexModifier: false, maxDexBonus: null, strengthRequirement: 13, stealthDisadvantage: true },
            "Shield": { name: 'Shield', description: 'Increases AC by 2', weight: 6, cost: '10 gp', type: 'Armor', armorCategory: 'Shield', baseAC: 2, addDexModifier: false, maxDexBonus: null, strengthRequirement: null, stealthDisadvantage: false },
            "Healing Potion": { name: 'Healing Potion', description: 'Regain 2d4+2 hit points', weight: 0.5, cost: '50 gp', type: 'Potion' },
            "Thieves' Tools": { name: 'Thieves\' Tools', description: 'Tools for disarming traps and opening locks', weight: 1, cost: '25 gp', type: 'Tool' },
            "Explorer's Pack": { name: "Explorer's Pack", description: "Includes a backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50ft rope.", weight: 59, cost: '10 gp', type: 'Adventuring Gear' },
            "Common Clothes": { name: "Set of Common Clothes", description: "Basic traveler's clothes.", weight: 3, cost: '5 sp', type: 'Adventuring Gear' },
            "Belt Pouch": { name: "Belt Pouch", description: "Small pouch.", weight: 1, cost: '5 sp', type: 'Adventuring Gear' },
             "Holy Symbol": { name: "Holy symbol", description: "A religious emblem.", weight: 1, cost: '5 gp', type: 'Adventuring Gear' },
             "Prayer Book": { name: "Prayer book", description: "Religious text.", weight: 5, cost: '25 gp', type: 'Adventuring Gear' },
             "Incense Sticks": { name: "5 sticks incense", description: "Incense.", weight: 0, cost: '0 gp', type: 'Adventuring Gear' }, // Simplify cost/weight for small items
             "Vestments": { name: "Vestments", description: "Ceremonial robes.", weight: 4, cost: '5 gp', type: 'Adventuring Gear' },
             "Small Knife": { name: "Small knife", description: "Simple knife.", weight: 0.5, cost: '1 gp', type: 'Weapon', weaponCategory: 'Simple Melee', damageDice: '1d4', damageType: 'Piercing', properties: ['Light'] }, // Example: treat as dagger
             "Map of City": { name: "Map of city", description: "A local map.", weight: 0, cost: '1 gp', type: 'Adventuring Gear' },
             "Pet Mouse": { name: "Pet mouse", description: "A small companion.", weight: 0, cost: '1 cp', type: 'Adventuring Gear' },
             "Token": { name: "Token", description: "A token of remembrance.", weight: 0, cost: '1 cp', type: 'Adventuring Gear' },
             "Insignia of Rank": { name: "Insignia of rank", description: "Military insignia.", weight: 0, cost: '5 gp', type: 'Adventuring Gear' },
             "Trophy": { name: "Trophy", description: "A captured trophy.", weight: 1, cost: '0 gp', type: 'Adventuring Gear' },
             "Gaming Set": { name: "Gaming set", description: "Dice or cards.", weight: 0.5, cost: '1 sp', type: 'Tool' },
             "Disguise Kit": { name: "Disguise kit", description: "Tools for disguise.", weight: 3, cost: '25 gp', type: 'Tool'},
             "Quarterstaff": { name: 'Quarterstaff', description: 'Simple melee weapon', weight: 4, cost: '2 sp', type: 'Weapon', weaponCategory: 'Simple Melee', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile (1d8)'] },
             "Spellbook": { name: "Spellbook", description: "Required for Wizards to prepare spells.", weight: 3, cost: '50 gp', type: 'Adventuring Gear' },
             "Component Pouch": { name: "Component Pouch", description: "A small pouch holding material components for spells.", weight: 2, cost: '25 gp', type: 'Adventuring Gear' },

        },
        monsters: {
           "Goblin": {
               name: "Goblin",
               size: "Small",
               type: "humanoid (goblinoid)",
               alignment: "neutral evil",
               armorClass: 15,
               hitPoints: { average: 7, dice: "2d6" },
               speed: "30 ft.",
               stats: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
               skills: { Stealth: 6 },
               senses: "darkvision 60 ft., passive Perception 9",
               languages: "Common, Goblin",
               challengeRating: "1/4",
               specialAbilities: [ { name: "Nimble Escape", description: "The goblin can take the Disengage or Hide action as a bonus action on each of its turns." }],
               actions: [ { name: "Scimitar", description: "Melee Weapon Attack:", attackBonus: 4, damageDice: "1d6", damageBonus: 2, damageType: "slashing" }, { name: "Shortbow", description: "Ranged Weapon Attack:", attackBonus: 4, damageDice: "1d6", damageBonus: 2, damageType: "piercing" }]
           }
        },
        npcs: {},
        backgrounds: {
             "Acolyte": {
                name: "Acolyte",
                description: "You have spent your life in the service of a temple to a specific god or pantheon of gods...",
                skillProficiencies: ["Insight", "Religion"],
                languages: { choose: 2 },
                feature: { name: "Shelter of the Faithful", description: "..." }, // Use correct name
                equipment: ["Holy symbol", "Prayer book", "5 sticks incense", "Vestments", "Common clothes", "15 gp"],
             },
             "Urchin": {
                name: "Urchin",
                description: "You grew up on the streets alone, orphaned, and poor...",
                skillProficiencies: ["Sleight of Hand", "Stealth"],
                toolProficiencies: ["Disguise kit", "Thieves' tools"],
                feature: { name: "City Secrets", description: "..." },
                equipment: ["Small knife", "Map of city", "Pet mouse", "Token", "Common clothes", "10 gp"],
             },
              "Soldier": {
                 name: "Soldier",
                 description: "War has been your life for as long as you care to remember...",
                 skillProficiencies: ["Athletics", "Intimidation"],
                 toolProficiencies: ["One type of gaming set", "Vehicles (land)"],
                 feature: { name: "Military Rank", description: "..." },
                 equipment: ["Insignia of rank", "Trophy", "Gaming set", "Common clothes", "10 gp"],
             }
        },
        features: SRD_FEATURES,
        spells: SRD_SPELLS, // Add spells here
    }
};
