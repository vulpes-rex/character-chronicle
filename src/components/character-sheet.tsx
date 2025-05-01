
// @ts-nocheck - Disabling TypeScript checks for rapid prototyping
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Trash2, Dices, ShieldCheck, Swords, ChevronUp, ChevronDown, BedDouble, BedSingle, HeartPulse } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getCharacterClasses,
    getCharacterRaces,
    getCumulativeClassFeatures,
    getRaceTraitsDetails,
    getAvailableEquipmentItems,
    getLevelUpOptions,
} from '@/services/dnd-api';
import type { CharacterClass, CharacterRace, Feature, EquipmentItem, CharacterLevel, HitPoints } from '@/services/dnd-api'; // Added HitPoints
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog'; // Import ShortRestDialog

// Helper function for dice rolling
const rollDice = (diceString: string): number => {
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


export function CharacterSheet() {
    const { toast } = useToast();
    // Basic character info state
    const [characterName, setCharacterName] = useState('');
    const [selectedClass, setSelectedClass] = useState<string | undefined>(undefined);
    const [selectedRace, setSelectedRace] = useState<string | undefined>(undefined);
    const [level, setLevel] = useState(1);
    const [alignment, setAlignment] = useState('');
    const [background, setBackground] = useState('');
    const [playerName, setPlayerName] = useState('');

    // Stats state
    const [stats, setStats] = useState({
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
    });

    // Calculate modifiers based on stats (MUST be declared before useEffects/renders that use it)
    const modifiers = useMemo(() => ({
        strength: Math.floor((stats.strength - 10) / 2),
        dexterity: Math.floor((stats.dexterity - 10) / 2),
        constitution: Math.floor((stats.constitution - 10) / 2),
        intelligence: Math.floor((stats.intelligence - 10) / 2),
        wisdom: Math.floor((stats.wisdom - 10) / 2),
        charisma: Math.floor((stats.charisma - 10) / 2),
    }), [stats]);

    // Hit Points and Hit Dice State
    const [hitPoints, setHitPoints] = useState<HitPoints>({
        current: 10,
        max: 10,
        temporary: 0,
        currentHitDice: 1,
        maxHitDice: 1,
        hitDieType: null,
    });

    // Data Fetching with React Query
    const { data: availableClasses = [], isLoading: isLoadingClasses } = useQuery<CharacterClass[], Error>({
        queryKey: ['characterClasses'],
        queryFn: getCharacterClasses,
        staleTime: Infinity, // Static data
    });

    const { data: availableRaces = [], isLoading: isLoadingRaces } = useQuery<CharacterRace[], Error>({
        queryKey: ['characterRaces'],
        queryFn: getCharacterRaces,
        staleTime: Infinity, // Static data
    });

     const selectedClassData = useMemo(() => availableClasses.find(c => c.name === selectedClass), [availableClasses, selectedClass]);
     const selectedRaceData = useMemo(() => availableRaces.find(r => r.name === selectedRace), [availableRaces, selectedRace]);

     const traitNames = selectedRaceData?.traits ?? [];

    // Fetch Race Trait Details
    const { data: raceTraits = [], isLoading: isLoadingRaceTraits, error: errorRaceTraits } = useQuery<Feature[], Error>({
        queryKey: ['raceTraits', traitNames],
        queryFn: () => getRaceTraitsDetails(traitNames),
        enabled: traitNames.length > 0, // Only run query if trait names are available
        staleTime: Infinity,
    });

    // Fetch Cumulative Class Features based on selected class and level
    const { data: classFeaturesRaw = [], isLoading: isLoadingClassFeatures, error: errorClassFeatures } = useQuery<Feature[], Error>({
        queryKey: ['classFeatures', selectedClass, level],
        queryFn: () => getCumulativeClassFeatures(selectedClass!, level),
        enabled: !!selectedClass && level > 0, // Only run query if class and level are selected
        staleTime: 5 * 60 * 1000, // Refetch class features every 5 mins or on change
    });

    // State for tracking feature uses
    const [featureUses, setFeatureUses] = useState<Record<string, number>>({});

    // Combine features and traits and add current uses
    const allFeaturesAndTraits = useMemo(() => {
        const combined = [...raceTraits, ...classFeaturesRaw];
        return combined.map(feature => ({
            ...feature,
            currentUses: featureUses[feature.name] ?? feature.maxUses ?? undefined, // Get uses from state, default to maxUses
        }));
    }, [raceTraits, classFeaturesRaw, featureUses]);


    // Initialize or update featureUses state when features/traits change
    useEffect(() => {
        const initialUses: Record<string, number> = {};
        [...raceTraits, ...classFeaturesRaw].forEach(feature => {
            if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 // Only initialize if not already present in featureUses or if maxUses changed
                 // This prevents resetting uses unnecessarily on data refetch
                 if (featureUses[feature.name] === undefined) {
                    initialUses[feature.name] = feature.maxUses;
                } else {
                     // Keep existing uses if feature is already tracked
                     initialUses[feature.name] = featureUses[feature.name];
                }
            }
        });
         // Update state only if there are changes needed
         if (Object.keys(initialUses).length > 0 || Object.keys(featureUses).length !== Object.keys(initialUses).length) {
              // Merge existing uses with newly initialized ones
              setFeatureUses(prevUses => ({ ...prevUses, ...initialUses }));
         }

    }, [raceTraits, classFeaturesRaw]); // Dependency on raw data


    // Update Max HP and Hit Dice when level or class changes (Depends on modifiers.constitution)
    useEffect(() => {
        if (selectedClassData && level > 0) {
            // Simple Max HP Calculation (Con mod per level, first level is max die roll)
            const conModifier = modifiers.constitution; // Safe to access now
            const hitDieSides = selectedClassData.hitDie ? parseInt(selectedClassData.hitDie.substring(1), 10) : 0;

            let maxHp = hitDieSides + conModifier; // First level
             if (level > 1) {
                 // Average roll (rounded up) + CON mod for subsequent levels
                 const averageRoll = Math.ceil((hitDieSides + 1) / 2);
                 maxHp += (level - 1) * (averageRoll + conModifier);
             }

            setHitPoints(prev => ({
                ...prev,
                max: Math.max(1, maxHp), // Ensure HP is at least 1
                // Reset current HP to new max if current exceeds new max or if it's the initial load
                 current: prev.max === 10 && prev.current === 10 ? Math.max(1, maxHp) : Math.min(prev.current, Math.max(1, maxHp)), // Keep current HP if possible
                maxHitDice: level,
                currentHitDice: Math.min(prev.currentHitDice, level), // Cap current HD at new level
                hitDieType: selectedClassData.hitDie,
            }));
        } else {
            // Reset if no class/level selected
            setHitPoints({
                current: 1, max: 1, temporary: 0, currentHitDice: 0, maxHitDice: 0, hitDieType: null
            });
        }
    }, [selectedClassData, level, modifiers.constitution]); // Dependency includes modifier now


    // Fetch Proficiency Bonus for the current level
    const { data: levelData } = useQuery<CharacterLevel, Error>({
        queryKey: ['levelData', selectedClass, level],
        queryFn: () => getLevelUpOptions(selectedClass!, level),
        enabled: !!selectedClass && level > 0,
        staleTime: 5 * 60 * 1000,
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);


    // Skills state (simplified proficiency tracking)
    const [skills, setSkills] = useState({
        acrobatics: false, athletics: false, arcana: false, deception: false, history: false,
        insight: false, intimidation: false, investigation: false, medicine: false, nature: false,
        perception: false, performance: false, persuasion: false, religion: false,
        sleightOfHand: false, stealth: false, survival: false,
    });

    // Determine proficiencies (weapons, armor, tools, skills) based on class
    const characterProficiencies = useMemo(() => {
        const profs = {
            armor: new Set<string>(),
            weapons: new Set<string>(), // Can be categories ('Simple', 'Martial') or specific names
            tools: new Set<string>(),
            skills: new Set<string>(), // Populated by user selection based on class options
            savingThrows: new Set<string>(),
        };

        if (selectedClassData) {
            selectedClassData.proficiencies.armor.forEach(p => profs.armor.add(p));
            selectedClassData.proficiencies.weapons.forEach(p => profs.weapons.add(p));
            (selectedClassData.proficiencies.tools ?? []).forEach(p => profs.tools.add(p));
            selectedClassData.proficiencies.savingThrows.forEach(p => profs.savingThrows.add(p));
            // Skills are handled by user selection, not added here directly yet
        }
         // Add race proficiencies if any (e.g., Dwarves with battleaxes) - currently not modeled in CharacterRace

        return profs;
    }, [selectedClassData]);


    // Equipment state - Now an array of EquipmentItem
    const [characterEquipment, setCharacterEquipment] = useState<EquipmentItem[]>([]);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);

    // Fetch available equipment items for the add dialog
    const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
        queryKey: ['availableEquipment'],
        queryFn: getAvailableEquipmentItems,
        staleTime: 60 * 60 * 1000, // Cache for 1 hour
    });

    // Backstory state
    const [backstory, setBackstory] = useState('');

    const handleStatChange = (statName: keyof typeof stats, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            setStats(prev => ({ ...prev, [statName]: numValue }));
        }
    };

    const handleHitPointChange = (type: 'current' | 'max' | 'temporary', value: string) => {
         const numValue = parseInt(value, 10);
         if (!isNaN(numValue)) {
             setHitPoints(prev => {
                 const newHp = { ...prev };
                 if (type === 'current') {
                     newHp.current = Math.max(0, Math.min(numValue, newHp.max)); // Clamp between 0 and max
                 } else if (type === 'max') {
                     newHp.max = Math.max(1, numValue); // Max HP >= 1
                     newHp.current = Math.min(newHp.current, newHp.max); // Adjust current if max decreased
                 } else { // temporary
                     newHp.temporary = Math.max(0, numValue);
                 }
                 return newHp;
             });
         } else if (value === '') { // Allow clearing the input
             setHitPoints(prev => ({ ...prev, [type]: type === 'temporary' ? 0 : (type === 'max' ? 1 : 0) }));
         }
     };


    const getModifier = useCallback((statValue: number): number => {
        return Math.floor((statValue - 10) / 2);
    }, []);


    const handleSkillToggle = (skillName: keyof typeof skills) => {
        setSkills(prev => ({ ...prev, [skillName]: !prev[skillName] }));
    };

    // Equip/Unequip Item Logic
    const handleToggleEquip = (itemName: string) => {
        setCharacterEquipment(prev =>
            prev.map(item =>
                item.name === itemName
                    ? { ...item, isEquipped: !item.isEquipped }
                    : item
            )
        );
    };


    const handleAddEquipment = (itemToAdd: EquipmentItem) => {
        setCharacterEquipment(prev => {
            const existingItemIndex = prev.findIndex(item => item.name === itemToAdd.name);
            if (existingItemIndex > -1) {
                // If item exists, update its quantity
                const updatedEquipment = [...prev];
                updatedEquipment[existingItemIndex] = {
                    ...updatedEquipment[existingItemIndex],
                    quantity: (updatedEquipment[existingItemIndex].quantity || 1) + (itemToAdd.quantity || 1),
                };
                return updatedEquipment;
            } else {
                // If item doesn't exist, add it with isEquipped defaulting to false
                return [...prev, { ...itemToAdd, quantity: itemToAdd.quantity || 1, isEquipped: false }];
            }
        });
    };

    const handleRemoveEquipment = (itemName: string) => {
        setCharacterEquipment(prev => prev.filter(item => item.name !== itemName));
    };

    const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
         setCharacterEquipment(prev =>
            prev.map(item =>
                item.name === itemName ? { ...item, quantity: Math.max(0, quantity) } : item
            ).filter(item => item.quantity > 0) // Remove item if quantity becomes 0
        );
    }

    // Calculate Armor Class (AC) - Depends on modifiers.dexterity
    const armorClass = useMemo(() => {
        let baseAC = 10;
        let dexMod = modifiers.dexterity; // Safe to access now
        let maxDex: number | null = null;
        let hasShield = false;
        let armorEquipped = false;

        characterEquipment
            .filter(item => item.isEquipped && item.type === 'Armor')
            .forEach(item => {
                if (item.armorCategory === 'Shield') {
                    hasShield = true;
                } else {
                    // Assume only one body armor can be effectively equipped
                    if (!armorEquipped && item.baseAC !== undefined) {
                        baseAC = item.baseAC; // Use armor's base AC
                        if (item.addDexModifier === false) { // Explicitly check for false
                            dexMod = 0; // Heavy armor typically doesn't add Dex
                        }
                        maxDex = item.maxDexBonus ?? null; // Check for Medium armor Dex cap
                        armorEquipped = true;
                    }
                }
            });

        // If no armor equipped, AC is 10 + Dex modifier
        if (!armorEquipped) {
           baseAC = 10;
        }


        // Apply Dex modifier cap if applicable
        if (maxDex !== null) {
            dexMod = Math.min(dexMod, maxDex);
        }

        // Base AC + Dex Modifier + Shield Bonus
        // Shield bonus is usually +2, check item details if variable shields exist
        const shieldBonus = hasShield ? (characterEquipment.find(i => i.isEquipped && i.armorCategory === 'Shield')?.baseAC ?? 2) : 0;

        return baseAC + dexMod + shieldBonus;
    }, [characterEquipment, modifiers.dexterity]); // Dependency includes modifier


    // Determine equipped weapons and actionable features
    const equippedWeapons = useMemo(() => characterEquipment.filter(item => item.isEquipped && item.type === 'Weapon'), [characterEquipment]);
    // Use the memoized 'allFeaturesAndTraits' which includes 'currentUses'
    const actionableFeatures = useMemo(() => allFeaturesAndTraits.filter(f => f.isActionable), [allFeaturesAndTraits]);

     // Function to check proficiency
    const isProficientWith = useCallback((item: EquipmentItem): boolean => {
        if (!selectedClassData) return false;

        if (item.type === 'Weapon') {
            // Check specific weapon name proficiency
            if (characterProficiencies.weapons.has(item.name)) return true;
            // Check weapon category proficiency
            if (item.weaponCategory && characterProficiencies.weapons.has(item.weaponCategory.split(' ')[0])) { // Check 'Simple' or 'Martial'
               return true;
            }
             // Handle specific class exceptions if needed (e.g., Monk weapons)
        } else if (item.type === 'Armor') {
             if (!item.armorCategory) return true; // Assume proficient if category unknown (e.g., Clothing)
             // Check armor category proficiency
             if (characterProficiencies.armor.has(item.armorCategory)) return true;
             // Check specific armor proficiency (less common)
             if (characterProficiencies.armor.has(item.name)) return true;
        }
        // TODO: Add Tool proficiency checks
        return false;
    }, [selectedClassData, characterProficiencies]);


    // Calculate Hit Bonus for a weapon - Depends on modifiers
    const getHitBonus = useCallback((weapon: EquipmentItem): number => {
        if (!proficiencyBonus) return 0;

        let abilityMod = modifiers.strength; // Default to Strength
        const isFinesse = weapon.properties?.includes('Finesse');

        // Use Dexterity for Finesse weapons if Dex > Str
        if (isFinesse && modifiers.dexterity > modifiers.strength) {
            abilityMod = modifiers.dexterity;
        }
        // Use Dexterity for Ranged weapons
        else if (weapon.weaponCategory?.includes('Ranged')) {
             abilityMod = modifiers.dexterity;
        }

        const proficiencyMod = isProficientWith(weapon) ? proficiencyBonus : 0;

        return abilityMod + proficiencyMod;
    }, [modifiers, proficiencyBonus, isProficientWith]); // Dependency includes modifier

    // Calculate Damage Bonus for a weapon - Depends on modifiers
    const getDamageBonus = useCallback((weapon: EquipmentItem): number => {
         let abilityMod = modifiers.strength; // Default to Strength
         const isFinesse = weapon.properties?.includes('Finesse');

         // Use Dexterity for Finesse weapons if Dex > Str
         if (isFinesse && modifiers.dexterity > modifiers.strength) {
             abilityMod = modifiers.dexterity;
         }
          // Ranged weapons typically use Dexterity for damage too (unless thrown property uses Str)
         else if (weapon.weaponCategory?.includes('Ranged') && !weapon.properties?.some(p => p.toLowerCase().includes('thrown'))) {
              abilityMod = modifiers.dexterity;
         }
         // Handle 'Thrown' property explicitly if needed (usually uses the same mod as melee attack)

        // Check for Fighting Styles like Dueling (+2 damage with one-handed weapon, no shield) - Placeholder
        let fightingStyleBonus = 0;
        // Example: if (fightingStyle === 'Dueling' && isOneHanded(weapon) && !hasShieldEquipped) fightingStyleBonus = 2;


         return abilityMod + fightingStyleBonus;
    }, [modifiers /* fightingStyle, hasShieldEquipped */]); // Dependency includes modifier


    // --- Action Handlers ---
    const handleAttackRoll = (weaponName: string, hitBonus: number) => {
        const roll = rollDice('1d20');
        const total = roll + hitBonus;
        toast({
            title: `${weaponName} Attack`,
            description: `Rolled ${roll} + ${hitBonus} = ${total}`,
        });
    };

    const handleDamageRoll = (weaponName: string, damageDice: string | undefined, damageBonus: number) => {
        if (!damageDice) {
             toast({ variant: "destructive", title: "Damage Roll Error", description: `No damage dice defined for ${weaponName}.` });
             return;
         }
        const roll = rollDice(damageDice);
        const total = roll + damageBonus;
        toast({
            title: `${weaponName} Damage`,
            description: `Rolled ${roll} (${damageDice}) + ${damageBonus} = ${Math.max(0, total)}`, // Damage can't be negative
        });
    };

    const handleUseFeature = (featureName: string) => {
         const feature = allFeaturesAndTraits.find(f => f.name === featureName);
         if (!feature || feature.currentUses === undefined || feature.currentUses === null) {
             // Handle features without uses (like passive traits marked actionable or unlimited use actions)
             toast({
                 title: `Used ${featureName}`,
                 description: feature?.description.split('.')[0] + '.' || "Feature action executed.",
             });
             // TODO: Implement logic for specific feature actions (e.g., Cunning Action choice)
             return;
         }

         if (feature.currentUses > 0) {
             setFeatureUses(prev => ({
                 ...prev,
                 [featureName]: prev[featureName] - 1,
             }));
             toast({
                 title: `Used ${featureName}`,
                 description: `${feature.currentUses - 1} uses remaining. ${feature.description.split('.')[0]}.`,
             });
             // TODO: Implement specific effect of using the feature (e.g., Second Wind healing)
             if (featureName === 'Second Wind') {
                  const healing = rollDice('1d10') + level;
                  setHitPoints(prev => ({
                      ...prev,
                      current: Math.min(prev.max, prev.current + healing)
                  }));
                   toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
             }
         } else {
             toast({
                 variant: "destructive",
                 title: `Cannot Use ${featureName}`,
                 description: "No uses remaining.",
             });
         }
     };


    // --- Rest Handlers ---
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);

    const handleShortRest = (hitDiceSpent: number, hpRecovered: number) => {
         setHitPoints(prev => ({
             ...prev,
             current: Math.min(prev.max, prev.current + hpRecovered),
             currentHitDice: Math.max(0, prev.currentHitDice - hitDiceSpent),
         }));

         // Reset features that refresh on short rest
         const usesReset: Record<string, number> = {};
         allFeaturesAndTraits.forEach(feature => {
             if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                 usesReset[feature.name] = feature.maxUses;
             }
         });
          setFeatureUses(prev => ({ ...prev, ...usesReset }));


         toast({
             title: "Short Rest Complete",
             description: `Recovered ${hpRecovered} HP. Spent ${hitDiceSpent} Hit Dice. Short rest features refreshed.`,
         });
     };

    const handleLongRest = () => {
        // Reset HP to max
        // Reset Hit Dice (regain up to half max HD, min 1)
        // Reset all feature uses
        const hitDiceToRegain = Math.max(1, Math.floor(hitPoints.maxHitDice / 2));
        const newCurrentHitDice = Math.min(hitPoints.maxHitDice, hitPoints.currentHitDice + hitDiceToRegain);

        setHitPoints(prev => ({
            ...prev,
            current: prev.max,
            temporary: 0, // Temp HP always goes away on long rest
            currentHitDice: newCurrentHitDice,
        }));

        // Reset all features that have uses
        const usesReset: Record<string, number> = {};
         allFeaturesAndTraits.forEach(feature => {
             if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 usesReset[feature.name] = feature.maxUses;
             }
         });
        setFeatureUses(usesReset); // Completely replace with reset values


        toast({
            title: "Long Rest Complete",
            description: `HP fully restored. Regained ${hitDiceToRegain} Hit Dice. All features refreshed.`,
        });
    };


  return (
    <>
        <ScrollArea className="h-full p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Card */}
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <Input
                            placeholder="Character Name"
                            value={characterName}
                            onChange={(e) => setCharacterName(e.target.value)}
                            className="text-2xl font-bold max-w-xs"
                            aria-label="Character Name"
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            {/* Class Selection */}
                            <Select value={selectedClass} onValueChange={(value) => {setSelectedClass(value); setFeatureUses({})}}> {/* Reset uses on class change */}
                               <SelectTrigger className="w-full" aria-label="Select Class">
                                   <SelectValue placeholder={isLoadingClasses ? "Loading..." : "Class"} />
                               </SelectTrigger>
                               <SelectContent>
                                   {availableClasses.map((charClass) => (
                                       <SelectItem key={charClass.name} value={charClass.name}>
                                           {charClass.name}
                                       </SelectItem>
                                   ))}
                                   {isLoadingClasses && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                               </SelectContent>
                           </Select>

                            {/* Race Selection */}
                            <Select value={selectedRace} onValueChange={(value) => {setSelectedRace(value); setFeatureUses({})}}> {/* Reset uses on race change */}
                                 <SelectTrigger className="w-full" aria-label="Select Race">
                                     <SelectValue placeholder={isLoadingRaces ? "Loading..." : "Race"} />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {availableRaces.map((charRace) => (
                                         <SelectItem key={charRace.name} value={charRace.name}>
                                             {charRace.name}
                                         </SelectItem>
                                     ))}
                                     {isLoadingRaces && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                 </SelectContent>
                             </Select>

                             <Input placeholder="Level" type="number" value={level} onChange={(e) => {setLevel(Math.max(1, parseInt(e.target.value) || 1)); setFeatureUses({})}} aria-label="Level"/> {/* Reset uses on level change */}
                             <Input placeholder="Background" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Background" />
                             <Input placeholder="Player Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} aria-label="Player Name"/>
                             <Input placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} aria-label="Alignment"/>
                         </div>
                     </div>
                      {/* Rest Buttons */}
                    <div className="flex justify-end gap-2 mt-4">
                         <Button variant="outline" size="sm" onClick={() => setIsShortRestDialogOpen(true)}>
                             <BedSingle className="mr-2 h-4 w-4" /> Short Rest
                         </Button>
                         <Button variant="default" size="sm" onClick={handleLongRest}>
                              <BedDouble className="mr-2 h-4 w-4" /> Long Rest
                         </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Main Content Grid */}
            <Tabs defaultValue="core" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="core">Core</TabsTrigger>
                    <TabsTrigger value="combat">Combat</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                    <TabsTrigger value="backstory">Backstory</TabsTrigger>
                </TabsList>

                {/* Core Tab */}
                <TabsContent value="core">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       {/* Column 1: Stats */}
                       <div className="space-y-6">
                         <Card className="bg-card/80 backdrop-blur-sm">
                           <CardHeader>
                             <CardTitle>Ability Scores</CardTitle>
                           </CardHeader>
                           <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {Object.entries(stats).map(([name, value]) => (
                               <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative pt-6"> {/* Added pt-6 */}
                                 <Label htmlFor={name} className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2">{name}</Label> {/* Adjusted label position */}
                                  <div className="relative mt-1">
                                     <Input
                                         id={name}
                                         type="number"
                                         value={value}
                                         onChange={(e) => handleStatChange(name as keyof typeof stats, e.target.value)}
                                         className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 appearance-none m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" // Hide number spinners
                                         aria-label={`${name} score`}
                                     />
                                     <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                                        {getModifier(value) >= 0 ? '+' : ''}{getModifier(value)}
                                     </div>
                                 </div>
                               </div>
                             ))}
                           </CardContent>
                         </Card>
                       </div>

                       {/* Column 2: Skills */}
                       <div className="space-y-6">
                          <Card className="bg-card/80 backdrop-blur-sm">
                              <CardHeader>
                                  <CardTitle>Skills</CardTitle>
                                  <CardDescription>Proficiency Bonus: +{proficiencyBonus}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                  {Object.entries(skills).map(([name, proficient]) => (
                                      <div key={name} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                                          <div className="flex items-center gap-2">
                                              <input
                                                  type="checkbox"
                                                  id={`skill-${name}`}
                                                  checked={proficient}
                                                  onChange={() => handleSkillToggle(name as keyof typeof skills)}
                                                  className="form-checkbox h-4 w-4 text-primary accent-primary focus:ring-primary rounded cursor-pointer"
                                                  aria-labelledby={`skill-label-${name}`}
                                              />
                                              <Label htmlFor={`skill-${name}`} id={`skill-label-${name}`} className="capitalize text-sm cursor-pointer">
                                                  {name.replace(/([A-Z])/g, ' $1')} {/* Add space before capitals */}
                                                  {/* TODO: Indicate associated stat */}
                                              </Label>
                                          </div>
                                          <span className="text-sm font-medium text-muted-foreground">
                                             {/* TODO: Calculate skill bonus = stat mod + (proficient ? prof bonus : 0) */}
                                             +0 {/* Placeholder */}
                                          </span>
                                      </div>
                                  ))}
                              </CardContent>
                          </Card>
                       </div>

                       {/* Column 3: Features & Traits */}
                       <div className="space-y-6">
                         <Card className="bg-card/80 backdrop-blur-sm">
                              <CardHeader>
                                  <CardTitle>Features & Traits</CardTitle>
                              </CardHeader>
                              <CardContent>
                                 {(isLoadingRaceTraits || isLoadingClassFeatures) && (
                                     <div className="space-y-3">
                                         <Skeleton className="h-8 w-full" />
                                         <Skeleton className="h-4 w-5/6" />
                                         <Skeleton className="h-8 w-full" />
                                         <Skeleton className="h-4 w-4/6" />
                                     </div>
                                 )}
                                 {(errorRaceTraits || errorClassFeatures) && (
                                      <Alert variant="destructive">
                                         <AlertTitle>Error Loading Features</AlertTitle>
                                         <AlertDescription>
                                             {errorRaceTraits?.message || errorClassFeatures?.message || 'Could not load some features.'}
                                         </AlertDescription>
                                     </Alert>
                                 )}
                                 {!isLoadingRaceTraits && !isLoadingClassFeatures && !errorRaceTraits && !errorClassFeatures && (
                                     allFeaturesAndTraits.length === 0 && (!selectedClass || !selectedRace) ? (
                                         <p className="text-sm text-muted-foreground">Select a race and class to see features and traits.</p>
                                     ) : allFeaturesAndTraits.length === 0 ? (
                                         <p className="text-sm text-muted-foreground">No features or traits found for this level/race/class combination.</p>
                                     ) : (
                                         <ScrollArea className="h-[400px]">
                                             <Accordion type="multiple" className="w-full">
                                                 {allFeaturesAndTraits.map((feature, index) => (
                                                     <AccordionItem value={`item-${index}-${feature.name}`} key={`${index}-${feature.name}`}>
                                                         <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                                             <span className='text-left'>{feature.name} <span className="text-xs text-muted-foreground">({feature.source})</span></span>
                                                         </AccordionTrigger>
                                                         <AccordionContent className="text-sm text-muted-foreground">
                                                             {feature.description}
                                                              {/* Display uses if applicable */}
                                                              {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                                                 <p className="text-xs mt-1 text-primary">
                                                                     Uses: {feature.currentUses ?? 'N/A'} / {feature.maxUses} (Resets on {feature.usesResetOn || 'N/A'})
                                                                 </p>
                                                              )}
                                                         </AccordionContent>
                                                     </AccordionItem>
                                                 ))}
                                             </Accordion>
                                         </ScrollArea>
                                     )
                                 )}
                              </CardContent>
                          </Card>
                       </div>
                   </div>
                </TabsContent>

                {/* Combat Tab */}
                <TabsContent value="combat">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {/* Column 1: Combat Stats */}
                         <div className="space-y-6">
                             <Card className="bg-card/80 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle>Combat Stats</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-3 gap-4 text-center">
                                   <div className="border rounded-md p-3 bg-secondary/30">
                                        <Label className="text-xs uppercase text-muted-foreground">Armor Class</Label>
                                        <div className="text-3xl font-bold mt-1">{armorClass}</div> {/* Calculated AC */}
                                    </div>
                                    <div className="border rounded-md p-3 bg-secondary/30">
                                         <Label className="text-xs uppercase text-muted-foreground">Initiative</Label>
                                         {/* Initiative is just Dex modifier */}
                                         <div className="text-3xl font-bold mt-1">{modifiers.dexterity >= 0 ? '+' : ''}{modifiers.dexterity}</div>
                                     </div>
                                     <div className="border rounded-md p-3 bg-secondary/30">
                                         <Label className="text-xs uppercase text-muted-foreground">Speed</Label>
                                         {/* TODO: Get base speed from race */}
                                         <div className="text-3xl font-bold mt-1">30 ft</div> {/* Placeholder */}
                                     </div>
                                     {/* Hit Points */}
                                    <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                                          <Label className="text-xs uppercase text-muted-foreground flex items-center justify-center gap-1"><HeartPulse className='inline h-3 w-3' /> Hit Points</Label>
                                          <div className="flex justify-center items-center gap-2 mt-1">
                                               <Input
                                                   type="number"
                                                   value={hitPoints.current}
                                                   onChange={(e) => handleHitPointChange('current', e.target.value)}
                                                   className="w-20 text-center text-lg font-semibold"
                                                   aria-label="Current Hit Points"
                                                   max={hitPoints.max}
                                                   min={0}
                                               />
                                               <span className="text-muted-foreground">/</span>
                                                <span className="w-20 text-center text-lg font-semibold">{hitPoints.max}</span> {/* Display Max HP */}
                                          </div>
                                           {hitPoints.temporary > 0 && (
                                              <p className="text-xs text-blue-400 mt-1">+{hitPoints.temporary} Temporary HP</p>
                                          )}
                                           {/* Hit Dice */}
                                           <div className="mt-2 pt-2 border-t border-border/50">
                                                <Label className="text-xs uppercase text-muted-foreground">Hit Dice</Label>
                                                <p className='text-sm font-medium'>{hitPoints.currentHitDice} / {hitPoints.maxHitDice} ({hitPoints.hitDieType || 'N/A'})</p>
                                           </div>
                                     </div>
                                     {/* TODO: Add Death Saves */}
                                 </CardContent>
                             </Card>
                         </div>

                         {/* Column 2 & 3: Actions */}
                         <div className="md:col-span-2 space-y-6">
                            <Card className="bg-card/80 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle>Actions</CardTitle>
                                    <CardDescription>Available actions based on equipped items and features.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {equippedWeapons.length === 0 && actionableFeatures.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">No actions available. Equip a weapon or gain actionable features.</p>
                                    )}

                                    {/* Equipped Weapon Actions */}
                                    {equippedWeapons.map((weapon, index) => {
                                        const hitBonus = getHitBonus(weapon);
                                        const damageBonus = getDamageBonus(weapon);
                                        return (
                                            <div key={`weapon-${index}-${weapon.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                 <div className='flex-grow'>
                                                     <p className="font-medium flex items-center gap-2">
                                                         <Swords className="h-4 w-4 text-primary" />
                                                         {weapon.name}
                                                          {weapon.properties?.includes('Finesse') && <Badge variant="outline" className='text-xs'>Finesse</Badge>}
                                                          {weapon.weaponCategory?.includes('Ranged') && <Badge variant="outline" className='text-xs'>Ranged</Badge>}
                                                     </p>
                                                     <p className='text-xs text-muted-foreground pl-6'>{weapon.description || weapon.weaponCategory}</p>
                                                 </div>
                                                <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                    <Button size="sm" variant="outline" onClick={() => handleAttackRoll(weapon.name, hitBonus)}>
                                                        <Dices className="mr-2 h-4 w-4" />
                                                        Hit: {hitBonus >= 0 ? '+' : ''}{hitBonus}
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleDamageRoll(weapon.name, weapon.damageDice, damageBonus)}>
                                                        <Dices className="mr-2 h-4 w-4" />
                                                        Dmg: {weapon.damageDice ?? 'N/A'} {damageBonus >= 0 ? '+' : ''}{damageBonus}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Actionable Features */}
                                    {actionableFeatures.map((feature, index) => (
                                          <div key={`feature-${index}-${feature.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                               <div className='flex-grow'>
                                                   <p className="font-medium flex items-center gap-2">
                                                        <ShieldCheck className="h-4 w-4 text-accent" /> {/* Example icon */}
                                                        {feature.name}
                                                       <Badge variant="outline" className='text-xs'>{feature.source}</Badge>
                                                   </p>
                                                   <p className='text-xs text-muted-foreground pl-6'>{feature.description.split('.')[0] + '.'} {/* Show first sentence */} </p>
                                                    {/* Display uses remaining */}
                                                    {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                                        <p className="text-xs text-primary pl-6 mt-1">
                                                             Uses: {feature.currentUses ?? 'N/A'} / {feature.maxUses}
                                                        </p>
                                                     )}
                                               </div>
                                              <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                  <Button
                                                     size="sm"
                                                     variant="default"
                                                     onClick={() => handleUseFeature(feature.name)}
                                                      disabled={feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0} // Disable if uses are 0
                                                     title={feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0 ? 'No uses remaining' : `Use ${feature.name}`}
                                                   >
                                                      Use Feature
                                                  </Button>
                                              </div>
                                          </div>
                                    ))}

                                    {/* TODO: Add Spell Actions if applicable */}

                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory">
                    <Card className="bg-card/80 backdrop-blur-sm">
                       <CardHeader className="flex flex-row items-center justify-between pb-2">
                           <CardTitle>Equipment</CardTitle>
                           <Button variant="ghost" size="icon" onClick={() => setIsAddEquipmentOpen(true)} aria-label="Add Equipment">
                               <PlusCircle className="h-5 w-5" />
                           </Button>
                       </CardHeader>
                       <CardContent>
                           {characterEquipment.length === 0 ? (
                               <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet.</p>
                           ) : (
                               <ScrollArea className="h-[400px] w-full">
                                   <ul className="space-y-2 pr-4">
                                       {characterEquipment.map((item, index) => (
                                           <li key={index} className="flex items-center justify-between group border-b pb-2 last:border-b-0">
                                               <div className='flex items-center gap-2 flex-grow min-w-0'>
                                                    <Input
                                                        type="number"
                                                        min="1" // Should not be 0 here, remove instead
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateEquipmentQuantity(item.name, parseInt(e.target.value))}
                                                        className="w-12 h-7 text-sm text-center px-1 py-0 shrink-0"
                                                        aria-label={`${item.name} quantity`}
                                                    />
                                                   <div className='flex flex-col min-w-0'>
                                                        <span className="text-sm font-medium truncate">{item.name}</span>
                                                        {item.description && (
                                                            <span className="text-xs text-muted-foreground truncate" title={item.description}>
                                                                {item.description}
                                                            </span>
                                                        )}
                                                    </div>
                                               </div>
                                               <div className="flex items-center gap-1 shrink-0 ml-2">
                                                   {/* Equip/Unequip Button */}
                                                    {(item.type === 'Weapon' || item.type === 'Armor') && (
                                                      <Button
                                                           variant={item.isEquipped ? "secondary" : "outline"}
                                                           size="xs" // Make button smaller
                                                           className='h-6 px-1.5 text-xs' // Adjust padding and height
                                                           onClick={() => handleToggleEquip(item.name)}
                                                           title={item.isEquipped ? `Unequip ${item.name}` : `Equip ${item.name}`}
                                                       >
                                                           {item.isEquipped ? <ChevronDown className="h-3 w-3"/> : <ChevronUp className="h-3 w-3"/>}
                                                       </Button>
                                                    )}
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" // Adjust size
                                                       onClick={() => handleRemoveEquipment(item.name)}
                                                       aria-label={`Remove ${item.name}`}
                                                   >
                                                       <Trash2 className="h-3.5 w-3.5" /> {/* Adjust icon size */}
                                                   </Button>
                                               </div>
                                           </li>
                                       ))}
                                   </ul>
                               </ScrollArea>
                           )}
                            {/* TODO: Add currency section */}
                       </CardContent>
                    </Card>
                </TabsContent>

                {/* Backstory Tab */}
                <TabsContent value="backstory">
                    <Card className="bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Backstory & Appearance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                               placeholder="Describe your character's history, personality, appearance..."
                               value={backstory}
                               onChange={(e) => setBackstory(e.target.value)}
                               className="min-h-[400px]"
                               aria-label="Character Backstory and Appearance"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs> {/* End Tabs */}
          </div>
        </ScrollArea>

        {/* Add Equipment Dialog */}
        <AddEquipmentDialog
            isOpen={isAddEquipmentOpen}
            onOpenChange={setIsAddEquipmentOpen}
            availableItems={availableEquipment}
            onAddItem={handleAddEquipment}
            isLoadingItems={isLoadingEquipment}
        />

         {/* Short Rest Dialog */}
         <ShortRestDialog
             isOpen={isShortRestDialogOpen}
             onOpenChange={setIsShortRestDialogOpen}
             maxHitDice={hitPoints.maxHitDice}
             currentHitDice={hitPoints.currentHitDice}
             hitDieType={hitPoints.hitDieType}
             constitutionModifier={modifiers.constitution}
             maxHp={hitPoints.max}
             currentHp={hitPoints.current}
             onConfirm={handleShortRest}
             rollDiceFn={rollDice} // Pass the rollDice helper
         />
    </>
  );
}

    