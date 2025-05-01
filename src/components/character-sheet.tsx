
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
import { useRouter } from 'next/navigation'; // Added useRouter
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Trash2, Dices, ShieldCheck, Swords, ChevronUp, ChevronDown, BedDouble, BedSingle, HeartPulse, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    // Keep API functions for fetching *definitions* (classes, races, items, features)
    getCharacterClasses,
    getCharacterRaces,
    getCumulativeClassFeatures,
    getRaceTraitsDetails,
    getAvailableEquipmentItems,
    getLevelUpOptions,
} from '@/services/dnd-api';
// Import Character type and service for potential updates (like HP/rest)
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState } from '@/lib/types';
import { updateCharacter } from '@/services/character-service';
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog';
import { rollDice } from '@/lib/types'; // Use central rollDice
import Link from 'next/link'; // For Edit button


interface CharacterSheetProps {
    initialCharacter: Character; // Character data is now passed in
}


export function CharacterSheet({ initialCharacter }: CharacterSheetProps) {
    const { toast } = useToast();
    const router = useRouter(); // If updates might redirect

    // --- Local UI State ---
    // State derived directly from initialCharacter prop, updated via simulated API calls
    const [characterState, setCharacterState] = useState<Character>(initialCharacter);
    const [isSaving, setIsSaving] = useState(false); // For HP/rest updates
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);


    // --- Derived Data --- (Recalculated when characterState changes)

    // Modifiers
    const modifiers = useMemo(() => ({
        strength: Math.floor((characterState.stats.strength - 10) / 2),
        dexterity: Math.floor((characterState.stats.dexterity - 10) / 2),
        constitution: Math.floor((characterState.stats.constitution - 10) / 2),
        intelligence: Math.floor((characterState.stats.intelligence - 10) / 2),
        wisdom: Math.floor((characterState.stats.wisdom - 10) / 2),
        charisma: Math.floor((characterState.stats.charisma - 10) / 2),
    }), [characterState.stats]);

    // Proficiency Bonus (Assuming level data lookup is efficient or cached)
    // We still need level data for proficiency bonus. Fetch it based on current level.
    const { data: levelData } = useQuery<Awaited<ReturnType<typeof getLevelUpOptions>>, Error>({
        queryKey: ['levelData', characterState.class, characterState.level],
        queryFn: () => getLevelUpOptions(characterState.class, characterState.level),
        enabled: !!characterState.class && characterState.level > 0,
        staleTime: Infinity, // Level data rarely changes for a given level/class
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);

    // Features & Traits (Directly from characterState)
    const allFeaturesAndTraits = useMemo(() => characterState.features ?? [], [characterState.features]);

     // State for tracking feature uses (initialized from characterState.features)
    const [featureUses, setFeatureUses] = useState<Record<string, number>>(() => {
        const initialUses: Record<string, number> = {};
        (characterState.features ?? []).forEach(feature => {
            if (feature.maxUses !== null && feature.maxUses !== undefined) {
                // Initialize uses from character data if available, otherwise default to max
                initialUses[feature.name] = feature.currentUses ?? feature.maxUses;
            }
        });
        return initialUses;
    });


    // --- Data Fetching for Definitions (Dropdowns, Item Details) ---
    const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
        queryKey: ['availableEquipment'],
        queryFn: getAvailableEquipmentItems,
        staleTime: 60 * 60 * 1000, // Cache for 1 hour
    });
    // Note: Class/Race dropdowns are not needed here as the character data already has them.

    // --- Memoized Calculations ---

    // Calculate AC
    const armorClass = useMemo(() => {
        let baseAC = 10;
        let dexMod = modifiers.dexterity;
        let maxDex: number | null = null;
        let hasShield = false;
        let armorEquipped = false;

        characterState.equipment
            .filter(item => item.isEquipped && item.type === 'Armor')
            .forEach(item => {
                if (item.armorCategory === 'Shield') {
                    hasShield = true;
                } else {
                    if (!armorEquipped && item.baseAC !== undefined) {
                        baseAC = item.baseAC;
                        if (item.addDexModifier === false) dexMod = 0;
                        maxDex = item.maxDexBonus ?? null;
                        armorEquipped = true;
                    }
                }
            });

        if (!armorEquipped) baseAC = 10;
        if (maxDex !== null) dexMod = Math.min(dexMod, maxDex);
        const shieldBonus = hasShield ? (characterState.equipment.find(i => i.isEquipped && i.armorCategory === 'Shield')?.baseAC ?? 2) : 0;
        return baseAC + dexMod + shieldBonus;
    }, [characterState.equipment, modifiers.dexterity]);

    // Equipped Weapons and Actionable Features
    const equippedWeapons = useMemo(() => characterState.equipment.filter(item => item.isEquipped && item.type === 'Weapon'), [characterState.equipment]);
    const actionableFeatures = useMemo(() =>
        allFeaturesAndTraits
            .filter(f => f.isActionable)
            .map(f => ({ // Merge current uses from local state
                 ...f,
                 currentUses: featureUses[f.name] ?? f.maxUses ?? undefined
            }))
    , [allFeaturesAndTraits, featureUses]);


     // Check Proficiency
    const isProficientWith = useCallback((item: EquipmentItem): boolean => {
        if (!characterState.proficiencies) return false;

        if (item.type === 'Weapon') {
            if (characterState.proficiencies.weapons.includes(item.name)) return true;
             // Check category simplified (e.g., "Simple" vs "Simple Melee")
            if (item.weaponCategory && characterState.proficiencies.weapons.some(p => item.weaponCategory!.startsWith(p))) return true;
        } else if (item.type === 'Armor') {
            if (!item.armorCategory) return true; // Assume proficient if category unknown
            if (characterState.proficiencies.armor.includes(item.armorCategory)) return true;
            if (characterState.proficiencies.armor.includes(item.name)) return true;
        }
        // TODO: Add Tool proficiency checks from characterState.proficiencies.tools
        return false;
    }, [characterState.proficiencies]);

    // Get Hit Bonus
    const getHitBonus = useCallback((weapon: EquipmentItem): number => {
        let abilityMod = modifiers.strength;
        const isFinesse = weapon.properties?.includes('Finesse');

        if (isFinesse && modifiers.dexterity > modifiers.strength) {
            abilityMod = modifiers.dexterity;
        } else if (weapon.weaponCategory?.includes('Ranged')) {
             abilityMod = modifiers.dexterity;
        }
        const proficiencyMod = isProficientWith(weapon) ? proficiencyBonus : 0;
        return abilityMod + proficiencyMod;
    }, [modifiers.strength, modifiers.dexterity, proficiencyBonus, isProficientWith]);

    // Get Damage Bonus
    const getDamageBonus = useCallback((weapon: EquipmentItem): number => {
         let abilityMod = modifiers.strength;
         const isFinesse = weapon.properties?.includes('Finesse');

         if (isFinesse && modifiers.dexterity > modifiers.strength) {
             abilityMod = modifiers.dexterity;
         } else if (weapon.weaponCategory?.includes('Ranged') && !weapon.properties?.some(p => p.toLowerCase().includes('thrown'))) {
              abilityMod = modifiers.dexterity;
         }
         // Add Fighting Style Bonus (would need to check features in characterState)
         let fightingStyleBonus = 0;
         // Example check:
         // const hasDueling = characterState.features.some(f => f.name === 'Dueling');
         // const isOneHanded = !weapon.properties?.includes('Two-Handed'); // Simplified check
         // const shieldEquipped = characterState.equipment.some(i => i.isEquipped && i.armorCategory === 'Shield');
         // if (hasDueling && isOneHanded && !shieldEquipped) {
         //    fightingStyleBonus = 2;
         // }

         return abilityMod + fightingStyleBonus;
    }, [modifiers.strength, modifiers.dexterity, characterState.features, characterState.equipment]); // Added dependencies


   // --- Update Functions (Simulate API calls, update local state) ---

    const updateCharacterData = async (updates: Partial<Character>) => {
        setIsSaving(true);
        const newState = { ...characterState, ...updates };
        try {
            // Prepare only the necessary fields to update
            const dataToSave: Partial<Omit<Character, 'id' | 'createdAt'>> = {};
            if ('hitPoints' in updates && updates.hitPoints) dataToSave.hitPoints = updates.hitPoints;
            if ('hitDice' in updates && updates.hitDice) dataToSave.hitDice = updates.hitDice;
            if ('equipment' in updates && updates.equipment) dataToSave.equipment = updates.equipment;
            if ('features' in updates && updates.features) dataToSave.features = updates.features; // Needed for persisting feature uses on rest

            await updateCharacter(characterState.id, dataToSave);
            setCharacterState(newState); // Update local state on success
            toast({ title: "Character Updated", description: "Changes saved successfully." });
        } catch (error) {
            console.error("Failed to update character:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes." });
            // Optionally revert local state: setCharacterState(characterState);
        } finally {
            setIsSaving(false);
        }
    };


    // --- Event Handlers ---

     const handleHitPointChange = (type: 'current' | 'temporary', value: string) => {
         const numValue = parseInt(value, 10);
         if (!isNaN(numValue)) {
             const newHp = { ...characterState.hitPoints };
             if (type === 'current') {
                 newHp.current = Math.max(0, Math.min(numValue, newHp.max));
             } else { // temporary
                 newHp.temporary = Math.max(0, numValue);
             }
             updateCharacterData({ hitPoints: newHp });
         } else if (value === '') { // Allow clearing
             const newHp = { ...characterState.hitPoints };
             newHp[type] = 0;
              updateCharacterData({ hitPoints: newHp });
         }
     };


    const handleToggleEquip = (itemName: string) => {
        const newEquipment = characterState.equipment.map(item =>
            item.name === itemName
                ? { ...item, isEquipped: !item.isEquipped }
                : item
        );
        updateCharacterData({ equipment: newEquipment });
    };

    const handleAddEquipment = (itemToAdd: EquipmentItem) => {
         const existingItemIndex = characterState.equipment.findIndex(item => item.name === itemToAdd.name);
         let newEquipment;
         if (existingItemIndex > -1) {
             newEquipment = characterState.equipment.map((item, index) =>
                index === existingItemIndex
                    ? { ...item, quantity: (item.quantity || 1) + (itemToAdd.quantity || 1) }
                    : item
            );
         } else {
            newEquipment = [...characterState.equipment, { ...itemToAdd, quantity: itemToAdd.quantity || 1, isEquipped: false }];
         }
         updateCharacterData({ equipment: newEquipment });
    };

    const handleRemoveEquipment = (itemName: string) => {
        const newEquipment = characterState.equipment.filter(item => item.name !== itemName);
        updateCharacterData({ equipment: newEquipment });
    };

     const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
         const newEquipment = characterState.equipment
            .map(item =>
                item.name === itemName ? { ...item, quantity: Math.max(0, quantity) } : item
            ).filter(item => item.quantity > 0); // Remove if quantity is 0
         updateCharacterData({ equipment: newEquipment });
    }

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
            description: `Rolled ${roll} (${damageDice}) + ${damageBonus} = ${Math.max(0, total)}`,
        });
    };

    const handleUseFeature = (featureName: string) => {
         const feature = actionableFeatures.find(f => f.name === featureName);
         if (!feature || feature.currentUses === undefined || feature.currentUses === null) {
             toast({
                 title: `Used ${featureName}`,
                 description: feature?.description.split('.')[0] + '.' || "Feature action executed.",
             });
             return;
         }

         if (feature.currentUses > 0) {
             const newUses = feature.currentUses - 1;
             setFeatureUses(prev => ({ ...prev, [featureName]: newUses })); // Update local UI state
             toast({
                 title: `Used ${featureName}`,
                 description: `${newUses} uses remaining.`,
             });

             // Apply immediate effects (like Second Wind healing)
             if (featureName === 'Second Wind') {
                  const healing = rollDice('1d10') + characterState.level;
                  const newHp = {
                     ...characterState.hitPoints,
                     current: Math.min(characterState.hitPoints.max, characterState.hitPoints.current + healing)
                  }
                  updateCharacterData({ hitPoints: newHp }); // Persist HP change
                   toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
             }
              // NOTE: Persisting the feature use count itself happens during rests
         } else {
             toast({
                 variant: "destructive",
                 title: `Cannot Use ${featureName}`,
                 description: "No uses remaining.",
             });
         }
     };


    // --- Rest Handlers ---
    const handleShortRest = async (hitDiceSpent: number, hpRecovered: number) => {
         const newHp: HitPointsState = {
             ...characterState.hitPoints,
             current: Math.min(characterState.hitPoints.max, characterState.hitPoints.current + hpRecovered),
         };
         const newHitDice: HitDiceState = {
             ...characterState.hitDice,
             remaining: Math.max(0, characterState.hitDice.remaining - hitDiceSpent),
         };

         const usesReset: Record<string, number> = {};
          allFeaturesAndTraits.forEach(feature => {
              if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                  usesReset[feature.name] = feature.maxUses;
              }
          });
          setFeatureUses(prev => ({ ...prev, ...usesReset })); // Update local UI state

         try {
            setIsSaving(true);
             const updatedFeaturesWithUses = characterState.features.map(f => {
                if (usesReset[f.name] !== undefined) {
                    return { ...f, currentUses: usesReset[f.name] };
                }
                 // Also persist the current count for features NOT reset
                const currentLocalUse = featureUses[f.name];
                if (currentLocalUse !== undefined && currentLocalUse !== null) {
                     return { ...f, currentUses: currentLocalUse };
                }
                return f;
             });

            await updateCharacter(characterState.id, {
               hitPoints: newHp,
               hitDice: newHitDice,
               features: updatedFeaturesWithUses,
             });
            setCharacterState(prev => ({
               ...prev,
               hitPoints: newHp,
               hitDice: newHitDice,
               features: updatedFeaturesWithUses,
            }));
             toast({
                 title: "Short Rest Complete",
                 description: `Recovered ${hpRecovered} HP. Spent ${hitDiceSpent} Hit Dice. Short rest features refreshed.`,
             });
         } catch (error) {
            console.error("Failed to save short rest changes:", error);
             toast({ variant: "destructive", title: "Rest Failed", description: "Could not save rest changes." });
         } finally {
             setIsSaving(false);
         }
     };

    const handleLongRest = async () => {
        const hitDiceToRegain = Math.max(1, Math.floor(characterState.hitDice.total / 2));
        const newCurrentHitDice = Math.min(characterState.hitDice.total, characterState.hitDice.remaining + hitDiceToRegain);

        const newHp: HitPointsState = {
            ...characterState.hitPoints,
            current: characterState.hitPoints.max,
            temporary: 0,
        };
         const newHitDice: HitDiceState = {
            ...characterState.hitDice,
            remaining: newCurrentHitDice,
        };

        const usesReset: Record<string, number> = {};
         allFeaturesAndTraits.forEach(feature => {
             if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 usesReset[feature.name] = feature.maxUses;
             }
         });
         setFeatureUses(usesReset); // Update local UI state

        try {
           setIsSaving(true);
            const updatedFeaturesWithUses = characterState.features.map(f => {
                if (usesReset[f.name] !== undefined) {
                    return { ...f, currentUses: usesReset[f.name] };
                }
                // Reset features without uses? Not usually necessary unless tracking passive states
                return f;
            });
           await updateCharacter(characterState.id, {
               hitPoints: newHp,
               hitDice: newHitDice,
               features: updatedFeaturesWithUses,
            });
           setCharacterState(prev => ({
               ...prev,
               hitPoints: newHp,
               hitDice: newHitDice,
               features: updatedFeaturesWithUses,
            }));
            toast({
                title: "Long Rest Complete",
                description: `HP fully restored. Regained ${hitDiceToRegain} Hit Dice. All features refreshed.`,
            });
         } catch (error) {
             console.error("Failed to save long rest changes:", error);
             toast({ variant: "destructive", title: "Rest Failed", description: "Could not save rest changes." });
         } finally {
            setIsSaving(false);
         }
    };


  // --- Render ---

  return (
    <>
        <ScrollArea className="h-full p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Card */}
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <h1 className="text-2xl font-bold">{characterState.characterName}</h1>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <span>Class: {characterState.class}</span>
                             <span>Race: {characterState.race}</span>
                             <span>Level: {characterState.level}</span>
                             <span>Background: {characterState.background}</span>
                             <span>Player: {characterState.playerName}</span>
                             <span>Alignment: {characterState.alignment}</span>
                         </div>
                     </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" asChild>
                           {/* Corrected link to edit page */}
                           <Link href={`/character/edit/${characterState.id}`}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Character
                           </Link>
                        </Button>
                         <Button variant="outline" size="sm" onClick={() => setIsShortRestDialogOpen(true)} disabled={isSaving}>
                             <BedSingle className="mr-2 h-4 w-4" /> Short Rest
                         </Button>
                         <Button variant="default" size="sm" onClick={handleLongRest} disabled={isSaving}>
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
                             {Object.entries(characterState.stats).map(([name, value]) => (
                               <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative pt-6">
                                 <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{name}</Label>
                                  <div className="relative mt-1">
                                     <div className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                        {value}
                                     </div>
                                     <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                                        {modifiers[name as keyof typeof modifiers] >= 0 ? '+' : ''}{modifiers[name as keyof typeof modifiers]}
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
                                   {Object.entries(characterState.skills)
                                      .sort(([a], [b]) => a.localeCompare(b))
                                      .map(([name, proficient]) => {
                                          let abilityScore: keyof typeof modifiers = 'strength';
                                           if (['acrobatics', 'sleight of hand', 'stealth'].includes(name)) abilityScore = 'dexterity';
                                           else if (['arcana', 'history', 'investigation', 'nature', 'religion'].includes(name)) abilityScore = 'intelligence';
                                           else if (['animal handling', 'insight', 'medicine', 'perception', 'survival'].includes(name)) abilityScore = 'wisdom';
                                           else if (['deception', 'intimidation', 'performance', 'persuasion'].includes(name)) abilityScore = 'charisma';

                                           const modifierValue = modifiers[abilityScore];
                                           const skillBonus = modifierValue + (proficient ? proficiencyBonus : 0);

                                          return (
                                              <div key={name} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                                                  <div className="flex items-center gap-2">
                                                       <div className={`h-3 w-3 rounded-full ${proficient ? 'bg-primary' : 'border border-muted'}`}></div>
                                                       <Label className="capitalize text-sm">
                                                          {name} {/* Display name directly */}
                                                          <span className='text-xs text-muted-foreground ml-1'>({abilityScore.substring(0, 3)})</span>
                                                      </Label>
                                                  </div>
                                                  <span className="text-sm font-medium text-foreground">
                                                     {skillBonus >= 0 ? '+' : ''}{skillBonus}
                                                  </span>
                                              </div>
                                          );
                                   })}
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
                                 {allFeaturesAndTraits.length === 0 ? (
                                     <p className="text-sm text-muted-foreground">No features or traits listed.</p>
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
                                                          {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                                             <p className="text-xs mt-1 text-primary">
                                                                  Uses: {featureUses[feature.name] ?? feature.maxUses} / {feature.maxUses} (Resets on {feature.usesResetOn || 'N/A'})
                                                             </p>
                                                          )}
                                                     </AccordionContent>
                                                 </AccordionItem>
                                             ))}
                                         </Accordion>
                                     </ScrollArea>
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
                                        <div className="text-3xl font-bold mt-1">{armorClass}</div>
                                    </div>
                                    <div className="border rounded-md p-3 bg-secondary/30">
                                         <Label className="text-xs uppercase text-muted-foreground">Initiative</Label>
                                         <div className="text-3xl font-bold mt-1">{modifiers.dexterity >= 0 ? '+' : ''}{modifiers.dexterity}</div>
                                     </div>
                                     <div className="border rounded-md p-3 bg-secondary/30">
                                         <Label className="text-xs uppercase text-muted-foreground">Speed</Label>
                                         {/* TODO: Better speed calculation based on race */}
                                         <div className="text-3xl font-bold mt-1">{characterState.race === 'Dwarf' ? '25 ft' : '30 ft'}</div>
                                     </div>
                                    <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                                          <Label className="text-xs uppercase text-muted-foreground flex items-center justify-center gap-1"><HeartPulse className='inline h-3 w-3' /> Hit Points</Label>
                                          <div className="flex justify-center items-center gap-2 mt-1">
                                               <Input
                                                   type="number"
                                                   value={characterState.hitPoints.current}
                                                   onChange={(e) => handleHitPointChange('current', e.target.value)}
                                                   className="w-20 text-center text-lg font-semibold"
                                                   aria-label="Current Hit Points"
                                                   max={characterState.hitPoints.max}
                                                   min={0}
                                                   disabled={isSaving}
                                               />
                                               <span className="text-muted-foreground">/</span>
                                                <span className="w-20 text-center text-lg font-semibold">{characterState.hitPoints.max}</span>
                                          </div>
                                           {characterState.hitPoints.temporary > 0 && (
                                                <div className='flex items-center justify-center gap-2 mt-1'>
                                                     <Label htmlFor='temp-hp' className='text-xs text-blue-400'>Temp HP:</Label>
                                                      <Input
                                                         id='temp-hp'
                                                         type="number"
                                                         value={characterState.hitPoints.temporary}
                                                         onChange={(e) => handleHitPointChange('temporary', e.target.value)}
                                                         className="w-16 h-6 text-center text-xs font-semibold"
                                                         aria-label="Temporary Hit Points"
                                                         min={0}
                                                         disabled={isSaving}
                                                     />
                                                 </div>
                                          )}
                                           <div className="mt-2 pt-2 border-t border-border/50">
                                                <Label className="text-xs uppercase text-muted-foreground">Hit Dice</Label>
                                                <p className='text-sm font-medium'>{characterState.hitDice.remaining} / {characterState.hitDice.total} ({characterState.hitDice.dieType || 'N/A'})</p>
                                           </div>
                                     </div>
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
                                        <p className="text-sm text-muted-foreground text-center py-4">No actions available.</p>
                                    )}
                                    {equippedWeapons.map((weapon, index) => {
                                        const hitBonus = getHitBonus(weapon);
                                        const damageBonus = getDamageBonus(weapon);
                                        return (
                                            <div key={`weapon-${index}-${weapon.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                 <div className='flex-grow'>
                                                     <p className="font-medium flex items-center gap-2 flex-wrap">
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
                                     {actionableFeatures.map((feature, index) => (
                                          <div key={`feature-${index}-${feature.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                               <div className='flex-grow'>
                                                   <p className="font-medium flex items-center gap-2 flex-wrap">
                                                        <ShieldCheck className="h-4 w-4 text-accent" />
                                                        {feature.name}
                                                        <Badge variant="outline" className='text-xs'>{feature.source}</Badge>
                                                   </p>
                                                   <p className='text-xs text-muted-foreground pl-6'>{feature.description.split('.')[0] + '.'}</p>
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
                                                      disabled={(feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0) || isSaving}
                                                      title={(feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0) ? 'No uses remaining' : `Use ${feature.name}`}
                                                   >
                                                      Use Feature
                                                  </Button>
                                              </div>
                                          </div>
                                     ))}
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
                           <Button variant="ghost" size="icon" onClick={() => setIsAddEquipmentOpen(true)} aria-label="Add Equipment" disabled={isSaving}>
                               <PlusCircle className="h-5 w-5" />
                           </Button>
                       </CardHeader>
                       <CardContent>
                           {characterState.equipment.length === 0 ? (
                               <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet.</p>
                           ) : (
                               <ScrollArea className="h-[400px] w-full">
                                   <ul className="space-y-2 pr-4">
                                       {characterState.equipment.map((item, index) => (
                                           <li key={`${item.name}-${index}`} className="flex items-center justify-between group border-b pb-2 last:border-b-0">
                                               <div className='flex items-center gap-2 flex-grow min-w-0'>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateEquipmentQuantity(item.name, parseInt(e.target.value))}
                                                        className="w-12 h-7 text-sm text-center px-1 py-0 shrink-0"
                                                        aria-label={`${item.name} quantity`}
                                                        disabled={isSaving}
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
                                                    {(item.type === 'Weapon' || item.type === 'Armor') && (
                                                      <Button
                                                           variant={item.isEquipped ? "secondary" : "outline"}
                                                           size="xs"
                                                           className='h-6 px-1.5 text-xs'
                                                           onClick={() => handleToggleEquip(item.name)}
                                                           title={item.isEquipped ? `Unequip ${item.name}` : `Equip ${item.name}`}
                                                           disabled={isSaving}
                                                       >
                                                           {item.isEquipped ? <ChevronDown className="h-3 w-3"/> : <ChevronUp className="h-3 w-3"/>}
                                                       </Button>
                                                    )}
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                                       onClick={() => handleRemoveEquipment(item.name)}
                                                       aria-label={`Remove ${item.name}`}
                                                       disabled={isSaving}
                                                   >
                                                       <Trash2 className="h-3.5 w-3.5" />
                                                   </Button>
                                               </div>
                                           </li>
                                       ))}
                                   </ul>
                               </ScrollArea>
                           )}
                       </CardContent>
                    </Card>
                </TabsContent>

                {/* Backstory Tab */}
                <TabsContent value="backstory">
                    <Card className="bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Backstory & Appearance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className='font-semibold mb-2'>Appearance</h3>
                                 <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[50px]">
                                    {characterState.appearance || 'No description provided.'}
                                </p>
                             </div>
                             <Separator />
                            <div>
                                <h3 className='font-semibold mb-2'>Backstory</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[150px]">
                                    {characterState.backstory || 'No description provided.'}
                                </p>
                           </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
          </div>
        </ScrollArea>

        <AddEquipmentDialog
            isOpen={isAddEquipmentOpen}
            onOpenChange={setIsAddEquipmentOpen}
            availableItems={availableEquipment}
            onAddItem={handleAddEquipment}
            isLoadingItems={isLoadingEquipment}
        />

         <ShortRestDialog
             isOpen={isShortRestDialogOpen}
             onOpenChange={setIsShortRestDialogOpen}
             maxHitDice={characterState.hitDice.total}
             currentHitDice={characterState.hitDice.remaining}
             hitDieType={characterState.hitDice.dieType}
             constitutionModifier={modifiers.constitution}
             maxHp={characterState.hitPoints.max}
             currentHp={characterState.hitPoints.current}
             onConfirm={handleShortRest}
             rollDiceFn={rollDice}
         />
    </>
  );
}
