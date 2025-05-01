
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
import { PlusCircle, Trash2, Dices, ShieldCheck, Swords, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getCharacterClasses,
    getCharacterRaces,
    getCumulativeClassFeatures,
    getRaceTraitsDetails,
    getAvailableEquipmentItems,
    getLevelUpOptions, // Import getLevelUpOptions
} from '@/services/dnd-api';
import type { CharacterClass, CharacterRace, Feature, EquipmentItem, CharacterLevel } from '@/services/dnd-api';
import { AddEquipmentDialog } from './add-equipment-dialog';

// Helper function for dice rolling
const rollDice = (diceString: string): number => {
    if (!diceString || !diceString.includes('d')) return 0;
    try {
        const [numDice, numSides] = diceString.toLowerCase().split('d').map(Number);
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
    const { data: classFeatures = [], isLoading: isLoadingClassFeatures, error: errorClassFeatures } = useQuery<Feature[], Error>({
        queryKey: ['classFeatures', selectedClass, level],
        queryFn: () => getCumulativeClassFeatures(selectedClass!, level),
        enabled: !!selectedClass && level > 0, // Only run query if class and level are selected
        staleTime: 5 * 60 * 1000, // Refetch class features every 5 mins or on change
    });

    // Fetch Proficiency Bonus for the current level
    const { data: levelData } = useQuery<CharacterLevel, Error>({
        queryKey: ['levelData', selectedClass, level],
        queryFn: () => getLevelUpOptions(selectedClass!, level),
        enabled: !!selectedClass && level > 0,
        staleTime: 5 * 60 * 1000,
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);

     // Combine features and traits
    const allFeaturesAndTraits = useMemo(() => [...raceTraits, ...classFeatures], [raceTraits, classFeatures]);

    // Stats state
    const [stats, setStats] = useState({
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
    });

    // Calculate modifiers based on stats
    const modifiers = useMemo(() => ({
        strength: Math.floor((stats.strength - 10) / 2),
        dexterity: Math.floor((stats.dexterity - 10) / 2),
        constitution: Math.floor((stats.constitution - 10) / 2),
        intelligence: Math.floor((stats.intelligence - 10) / 2),
        wisdom: Math.floor((stats.wisdom - 10) / 2),
        charisma: Math.floor((stats.charisma - 10) / 2),
    }), [stats]);

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

    // Calculate Armor Class (AC)
    const armorClass = useMemo(() => {
        let baseAC = 10;
        let dexMod = modifiers.dexterity;
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
                    if (!armorEquipped) {
                        baseAC = item.baseAC ?? baseAC; // Use armor's base AC
                        if (!item.addDexModifier) {
                            dexMod = 0; // Heavy armor typically doesn't add Dex
                        }
                        maxDex = item.maxDexBonus ?? null; // Check for Medium armor Dex cap
                        armorEquipped = true;
                    }
                }
            });

        // Apply Dex modifier cap if applicable
        if (maxDex !== null) {
            dexMod = Math.min(dexMod, maxDex);
        }

        // Base AC + Dex Modifier + Shield Bonus
        return baseAC + dexMod + (hasShield ? 2 : 0);
    }, [characterEquipment, modifiers.dexterity]);


    // Determine equipped weapons and actionable features
    const equippedWeapons = useMemo(() => characterEquipment.filter(item => item.isEquipped && item.type === 'Weapon'), [characterEquipment]);
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


    // Calculate Hit Bonus for a weapon
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
    }, [modifiers, proficiencyBonus, isProficientWith]);

    // Calculate Damage Bonus for a weapon
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
    }, [modifiers, isProficientWith /* fightingStyle, hasShieldEquipped */]); // Add dependencies if fighting style is implemented

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

    const handleFeatureAction = (featureName: string) => {
         // TODO: Implement logic for specific feature actions (e.g., Second Wind, Action Surge)
         // This might involve tracking uses, rolling dice, applying effects, etc.
         toast({
             title: `Used ${featureName}`,
             description: "Feature action executed (implementation pending).",
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
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
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
                            <Select value={selectedRace} onValueChange={setSelectedRace}>
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

                             <Input placeholder="Level" type="number" value={level} onChange={(e) => setLevel(Math.max(1, parseInt(e.target.value) || 1))} aria-label="Level"/>
                             <Input placeholder="Background" value={background} onChange={(e) => setBackground(e.target.value)} aria-label="Background" />
                             <Input placeholder="Player Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} aria-label="Player Name"/>
                             <Input placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} aria-label="Alignment"/>
                         </div>
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
                               <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative">
                                 <Label htmlFor={name} className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">{name}</Label>
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
                                                     <AccordionItem value={`item-${index}`} key={index}>
                                                         <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                                             <span className='text-left'>{feature.name} <span className="text-xs text-muted-foreground">({feature.source})</span></span>
                                                         </AccordionTrigger>
                                                         <AccordionContent className="text-sm text-muted-foreground">
                                                             {feature.description}
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
                                    <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                                        <Label className="text-xs uppercase text-muted-foreground">Hit Points</Label>
                                        <div className="flex justify-center items-center gap-2 mt-1">
                                            {/* TODO: Add state for current/max HP */}
                                            <Input type="number" placeholder="Current" className="w-20 text-center" aria-label="Current Hit Points"/>
                                             <span className="text-muted-foreground">/</span>
                                            <Input type="number" placeholder="Max" className="w-20 text-center" aria-label="Maximum Hit Points"/>
                                         </div>
                                     </div>
                                     {/* TODO: Add Hit Dice, Death Saves */}
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
                                               </div>
                                              <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                                  <Button size="sm" variant="default" onClick={() => handleFeatureAction(feature.name)}>
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
                                                           size="sm"
                                                           className='h-7 px-2 text-xs'
                                                           onClick={() => handleToggleEquip(item.name)}
                                                           title={item.isEquipped ? `Unequip ${item.name}` : `Equip ${item.name}`}
                                                       >
                                                           {item.isEquipped ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}
                                                       </Button>
                                                    )}
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                                       onClick={() => handleRemoveEquipment(item.name)}
                                                       aria-label={`Remove ${item.name}`}
                                                   >
                                                       <Trash2 className="h-4 w-4" />
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
    </>
  );
}
