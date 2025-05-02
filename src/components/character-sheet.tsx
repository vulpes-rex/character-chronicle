
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
import { PlusCircle, Trash2, Dices, ShieldCheck, Swords, ChevronUp, ChevronDown, BedDouble, BedSingle, HeartPulse, Edit, CheckSquare, Square } from 'lucide-react'; // Added CheckSquare, Square
import { useToast } from '@/hooks/use-toast';
import {
    getCharacterClasses,
    getCharacterRaces,
    getCumulativeClassFeatures,
    getRaceTraitsDetails,
    getAvailableEquipmentItems,
    getLevelUpOptions,
} from '@/services/dnd-api';
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, FeatureEffectMetadata } from '@/lib/types'; // Import FeatureEffectMetadata
import { updateCharacter } from '@/services/character-service';
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog';
import { rollDice, SKILL_ABILITY_MAP, calculateSkillModifier, ALL_SKILLS } from '@/lib/types'; // Use central utils/types
import Link from 'next/link'; // For Edit button
import { DDDiceRoller } from './dddice-roller';


interface CharacterSheetProps {
    initialCharacter: Character; // Character data is now passed in (includes base stats)
}


export function CharacterSheet({ initialCharacter }: CharacterSheetProps) {
    const { toast } = useToast();
    const router = useRouter(); // If updates might redirect

    // --- Local UI State ---
    const [characterState, setCharacterState] = useState<Character>(initialCharacter);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);
    const [diceRollResult, setDiceRollResult] = useState<string | null>(null);
    const [rollerKey, setRollerKey] = useState(0); // To force re-render of roller


    // --- Calculate Derived Stats from Base Stats and Features ---
    const derivedStats = useMemo(() => {
        const stats = { ...characterState.stats }; // Start with base stats
        (characterState.features || []).forEach(feature => {
            if (feature.metadata?.effectType === 'statBonus') {
                const metadata = feature.metadata as FeatureEffectMetadata & { effectType: 'statBonus' };
                 // TODO: Add condition checking if metadata.condition exists
                Object.entries(metadata.stats).forEach(([stat, bonus]) => {
                     if (stats[stat as keyof typeof stats] !== undefined) {
                        stats[stat as keyof typeof stats] += bonus;
                    }
                });
            }
        });
        return stats;
    }, [characterState.stats, characterState.features]);

    const modifiers = useMemo(() => ({
        strength: Math.floor((derivedStats.strength - 10) / 2),
        dexterity: Math.floor((derivedStats.dexterity - 10) / 2),
        constitution: Math.floor((derivedStats.constitution - 10) / 2),
        intelligence: Math.floor((derivedStats.intelligence - 10) / 2),
        wisdom: Math.floor((derivedStats.wisdom - 10) / 2),
        charisma: Math.floor((derivedStats.charisma - 10) / 2),
    }), [derivedStats]);

    // --- Fetch Level Data (Proficiency Bonus) ---
    const { data: levelData } = useQuery<Awaited<ReturnType<typeof getLevelUpOptions>>, Error>({
        queryKey: ['levelData', characterState.class, characterState.level],
        queryFn: () => getLevelUpOptions(characterState.class, characterState.level),
        enabled: !!characterState.class && characterState.level > 0,
        staleTime: Infinity,
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);


    const allFeaturesAndTraits = useMemo(() => characterState.features ?? [], [characterState.features]);

    const [featureUses, setFeatureUses] = useState<Record<string, number>>(() => {
        const initialUses: Record<string, number> = {};
        (characterState.features ?? []).forEach(feature => {
            if (feature.maxUses !== null && feature.maxUses !== undefined) {
                initialUses[feature.name] = feature.currentUses ?? feature.maxUses;
            }
        });
        return initialUses;
    });


    // --- Data Fetching for Definitions (Dropdowns, Item Details) ---
    const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
        queryKey: ['availableEquipment'],
        queryFn: getAvailableEquipmentItems,
        staleTime: 60 * 60 * 1000,
    });


    // --- Memoized Calculations (Using derived stats/modifiers) ---

     const armorClass = useMemo(() => {
         let baseAC = 10;
         let dexModForAC = modifiers.dexterity; // Use derived modifier
         let maxDex: number | null = null;
         let hasShield = false;
         let armorEquipped = false;
         let unarmoredDefenseValue: number | null = null;

         // Check for Unarmored Defense features first
         characterState.features.forEach(f => {
             if (f.name === 'Unarmored Defense (Barbarian)') {
                 unarmoredDefenseValue = 10 + modifiers.dexterity + modifiers.constitution;
             } else if (f.name === 'Unarmored Defense (Monk)') {
                 unarmoredDefenseValue = 10 + modifiers.dexterity + modifiers.wisdom;
             }
         });

         // Check equipped armor
         characterState.equipment
             .filter(item => item.isEquipped && item.type === 'Armor')
             .forEach(item => {
                 if (item.armorCategory === 'Shield') {
                     hasShield = true;
                 } else {
                     if (!armorEquipped && item.baseAC !== undefined) {
                         baseAC = item.baseAC;
                         if (item.addDexModifier === false) dexModForAC = 0;
                         maxDex = item.maxDexBonus ?? null;
                         armorEquipped = true;
                     }
                 }
             });

         // Apply Unarmored Defense if applicable
         const canUseUnarmoredDefense = unarmoredDefenseValue !== null && !armorEquipped && (f.name.includes('Barbarian') || !hasShield);
         if (canUseUnarmoredDefense) {
             baseAC = unarmoredDefenseValue!;
             dexModForAC = 0; // Modifier is already included in the formula
         } else if (!armorEquipped) {
             baseAC = 10; // Default unarmored
             dexModForAC = modifiers.dexterity; // Use full derived dex
         }

         // Apply Max Dex Bonus from armor
         if (maxDex !== null) {
             dexModForAC = Math.min(dexModForAC, maxDex);
         }

         // Calculate final AC
         let finalAC = baseAC + dexModForAC + (hasShield ? 2 : 0); // Standard shield bonus = 2

         // Apply direct AC bonuses from features (e.g., Fighting Style: Defense)
         characterState.features.forEach(f => {
             if (f.metadata?.effectType === 'acBonus') {
                 // TODO: Add condition checking based on f.metadata.condition
                 finalAC += (f.metadata as FeatureEffectMetadata & { effectType: 'acBonus' }).value;
             }
         });

         return finalAC;
     }, [characterState.equipment, characterState.features, modifiers]);


    const equippedWeapons = useMemo(() => characterState.equipment.filter(item => item.isEquipped && item.type === 'Weapon'), [characterState.equipment]);
    const actionableFeatures = useMemo(() =>
        allFeaturesAndTraits
            .filter(f => f.isActionable)
            .map(f => ({
                 ...f,
                 currentUses: featureUses[f.name] ?? f.maxUses ?? undefined
            }))
    , [allFeaturesAndTraits, featureUses]);


    const isProficientWith = useCallback((item: EquipmentItem): boolean => {
        if (!characterState.proficiencies) return false;

        if (item.type === 'Weapon') {
            if (characterState.proficiencies.weapons.includes(item.name)) return true;
            // Check weapon category proficiency (e.g., "Simple", "Martial", or specific types like "Longswords")
            if (item.weaponCategory) {
                const categories = item.weaponCategory.split(' '); // e.g., ["Simple", "Melee"]
                if (characterState.proficiencies.weapons.some(p => categories.includes(p) || p === item.weaponCategory)) {
                    return true;
                }
            }
             // Check specific weapon name again (e.g., proficiency with "Rapier")
             if (characterState.proficiencies.weapons.some(p => p === item.name)) return true;

        } else if (item.type === 'Armor') {
            if (!item.armorCategory) return true; // Items like clothes don't require proficiency
            // Check armor category proficiency (e.g., "Light", "Medium", "Heavy", "Shields")
            if (characterState.proficiencies.armor.includes(item.armorCategory)) return true;
            // Check specific armor name proficiency
             if (characterState.proficiencies.armor.includes(item.name)) return true;
        }
        return false;
    }, [characterState.proficiencies]);


    const getHitBonus = useCallback((weapon: EquipmentItem): number => {
        let abilityMod = modifiers.strength; // Use derived modifier
        const isFinesse = weapon.properties?.includes('Finesse');

        if (isFinesse && modifiers.dexterity > modifiers.strength) {
            abilityMod = modifiers.dexterity;
        } else if (weapon.weaponCategory?.includes('Ranged')) {
             abilityMod = modifiers.dexterity;
        }
        const proficiencyMod = isProficientWith(weapon) ? proficiencyBonus : 0;
        // TODO: Add other potential bonuses (e.g., Archery fighting style +2 for ranged)
        let fightingStyleBonus = 0;
        if (weapon.weaponCategory?.includes('Ranged') && characterState.features.some(f => f.name === 'Fighting Style: Archery')) {
            fightingStyleBonus = 2;
        }
        return abilityMod + proficiencyMod + fightingStyleBonus;
    }, [modifiers.strength, modifiers.dexterity, proficiencyBonus, isProficientWith, characterState.features]);


    const getDamageBonus = useCallback((weapon: EquipmentItem): number => {
         let abilityMod = modifiers.strength; // Use derived modifier
         const isFinesse = weapon.properties?.includes('Finesse');

         if (isFinesse && modifiers.dexterity > modifiers.strength) {
             abilityMod = modifiers.dexterity;
         } else if (weapon.weaponCategory?.includes('Ranged') && !weapon.properties?.some(p => p.toLowerCase().includes('thrown'))) {
              abilityMod = modifiers.dexterity;
         }
         let fightingStyleBonus = 0;
         // Example check (simplified):
         // if (characterState.features.some(f => f.name === 'Dueling') && ...) fightingStyleBonus = 2;

         return abilityMod + fightingStyleBonus;
    }, [modifiers.strength, modifiers.dexterity, characterState.features, characterState.equipment]);


    // Calculated skill modifiers using derived stats
    const skillModifiers = useMemo(() => {
        const mods: Record<string, number> = {};
        ALL_SKILLS.forEach(skill => {
            const proficient = !!characterState.skills[skill];
             // Pass derived stats to the calculation function
            mods[skill] = calculateSkillModifier(skill, derivedStats, proficient, proficiencyBonus);
        });
        return mods;
    }, [derivedStats, characterState.skills, proficiencyBonus]);


   // --- Update Functions ---

    const updateCharacterData = async (updates: Partial<Character>) => {
        setIsSaving(true);
        // IMPORTANT: Only save the fields that are meant to be persisted (base stats, equipment, HP/HD state, features with current uses).
        // Derived values (modifiers, final AC, final proficiencies) should NOT be saved back directly.
        const dataToSave: Partial<Omit<Character, 'id' | 'createdAt'>> = {};
        const newState = { ...characterState }; // Start with current local state

        if ('hitPoints' in updates && updates.hitPoints) {
            dataToSave.hitPoints = updates.hitPoints;
            newState.hitPoints = updates.hitPoints;
        }
        if ('hitDice' in updates && updates.hitDice) {
            dataToSave.hitDice = updates.hitDice;
            newState.hitDice = updates.hitDice;
        }
        if ('equipment' in updates && updates.equipment) {
            dataToSave.equipment = updates.equipment;
            newState.equipment = updates.equipment;
        }
        if ('features' in updates && updates.features) {
            // Only save features with potentially updated currentUses
             dataToSave.features = updates.features.map(f => ({
                 name: f.name,
                 description: f.description,
                 source: f.source,
                 metadata: f.metadata,
                 isActionable: f.isActionable,
                 maxUses: f.maxUses,
                 usesResetOn: f.usesResetOn,
                 currentUses: f.currentUses, // Persist current uses
             }));
            newState.features = updates.features; // Update local state fully
        }
        // Never save derivedStats directly, only baseCharacter.stats should be persisted
        // if ('stats' in updates) { /* DO NOT SAVE DERIVED STATS */ }

        try {
            if (Object.keys(dataToSave).length > 0) {
                 await updateCharacter(characterState.id, dataToSave);
                 setCharacterState(newState); // Update local state after successful save
                 toast({ title: "Character Updated", description: "Changes saved successfully." });
            } else {
                toast({ title: "No Changes", description: "No data needed saving." });
            }
        } catch (error) {
            console.error("Failed to update character:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes." });
            // Potentially revert local state if save fails?
        } finally {
            setIsSaving(false);
        }
    };


    // --- Event Handlers ---

     const handleHitPointChange = (type: 'current' | 'temporary', value: string) => {
         const numValue = parseInt(value, 10);
         const currentHp = characterState.hitPoints.current;
         const maxHp = characterState.hitPoints.max;
         const tempHp = characterState.hitPoints.temporary;

         if (!isNaN(numValue)) {
             const newHpState = { ...characterState.hitPoints };
             if (type === 'current') {
                 newHpState.current = Math.max(0, Math.min(numValue, maxHp));
             } else {
                 newHpState.temporary = Math.max(0, numValue);
             }
             // Update local state immediately for responsiveness
             setCharacterState(prev => ({ ...prev, hitPoints: newHpState }));
             // Debounce or trigger save after a short delay? For now, direct save.
             updateCharacterData({ hitPoints: newHpState });
         } else if (value === '') {
             const newHpState = { ...characterState.hitPoints };
             newHpState[type] = 0;
             setCharacterState(prev => ({ ...prev, hitPoints: newHpState }));
             updateCharacterData({ hitPoints: newHpState });
         }
     };


    const handleToggleEquip = (itemName: string) => {
        const newEquipment = characterState.equipment.map(item =>
            item.name === itemName
                ? { ...item, isEquipped: !item.isEquipped }
                : item
        );
        // Update local state immediately
        setCharacterState(prev => ({ ...prev, equipment: newEquipment }));
        updateCharacterData({ equipment: newEquipment }); // Save the change
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
         // Update local state immediately
         setCharacterState(prev => ({ ...prev, equipment: newEquipment }));
         updateCharacterData({ equipment: newEquipment }); // Save the change
    };

    const handleRemoveEquipment = (itemName: string) => {
        const newEquipment = characterState.equipment.filter(item => item.name !== itemName);
         // Update local state immediately
        setCharacterState(prev => ({ ...prev, equipment: newEquipment }));
        updateCharacterData({ equipment: newEquipment }); // Save the change
    };

     const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
         const newQuantity = Math.max(0, quantity);
         const newEquipment = characterState.equipment
            .map(item =>
                item.name === itemName ? { ...item, quantity: newQuantity } : item
            ).filter(item => item.quantity > 0);
        // Update local state immediately
        setCharacterState(prev => ({ ...prev, equipment: newEquipment }));
        updateCharacterData({ equipment: newEquipment }); // Save the change
    }

    // --- Dice Rolling Handler ---
    const triggerDiceRoll = (rollString: string, label: string) => {
         const roll = rollDice(rollString);
         const resultText = `${label}: Rolled ${roll} (${rollString})`;
         setDiceRollResult(resultText);
         setRollerKey(prev => prev + 1); // Increment key to trigger reroll animation
         toast({
             title: `${label} Check`,
             description: `Result: ${roll}`,
         });
    };


    // --- Action Handlers ---
    const handleAttackRoll = (weaponName: string, hitBonus: number) => {
        const roll = rollDice('1d20');
        const total = roll + hitBonus;
        const resultText = `${weaponName} Attack: Rolled ${roll} + ${hitBonus} = ${total} (1d20)`; // Include dice notation
        setDiceRollResult(resultText);
        setRollerKey(prev => prev + 1); // Trigger dddice roller
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
        const resultText = `${weaponName} Damage: Rolled ${roll} (${damageDice}) + ${damageBonus} = ${Math.max(0, total)}`;
        setDiceRollResult(resultText);
        setRollerKey(prev => prev + 1); // Trigger dddice roller
        toast({
            title: `${weaponName} Damage`,
            description: resultText,
        });
    };

     const handleSkillCheck = (skillName: string) => {
         const modifier = skillModifiers[skillName.toLowerCase()];
         const roll = rollDice('1d20');
         const total = roll + modifier;
         const resultText = `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check: Rolled ${roll} + ${modifier} = ${total} (1d20)`; // Include dice notation
         setDiceRollResult(resultText);
         setRollerKey(prev => prev + 1); // Trigger dddice roller
         toast({
             title: `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check`,
             description: `Rolled ${roll} + ${modifier} = ${total}`,
         });
     };


    const handleUseFeature = (featureName: string) => {
         const feature = characterState.features.find(f => f.name === featureName);
         if (!feature) return;

         const currentUses = featureUses[featureName]; // Get current uses from local state

         if (feature.maxUses === null || feature.maxUses === undefined || currentUses === undefined || currentUses === null) {
             // Feature has unlimited uses or doesn't track them
             toast({
                 title: `Used ${featureName}`,
                 description: (typeof feature?.description === 'string' && feature.description.length > 0)
                     ? feature.description.split('.')[0] + '.'
                     : "Feature action executed.",
             });
              // Special handling for features like Second Wind
             if (featureName === 'Second Wind') { /* Handle effect */ }
             return;
         }

         if (currentUses > 0) {
             const newUses = currentUses - 1;
             const newFeatureUses = { ...featureUses, [featureName]: newUses };
             setFeatureUses(newFeatureUses); // Update local UI state first

             toast({
                 title: `Used ${featureName}`,
                 description: `${newUses} uses remaining.`,
             });

             // Special handling for features like Second Wind
             if (featureName === 'Second Wind') {
                  const healing = rollDice('1d10') + characterState.level;
                  const newHpState = {
                     ...characterState.hitPoints,
                     current: Math.min(characterState.hitPoints.max, characterState.hitPoints.current + healing)
                  }
                   // We need to update both features (for uses) and hitpoints
                   const updatedFeaturesForSave = characterState.features.map(f =>
                       f.name === featureName ? { ...f, currentUses: newUses } : f
                   );
                   updateCharacterData({ hitPoints: newHpState, features: updatedFeaturesForSave });
                   toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
                   return; // Exit early as updateCharacterData was called
             }

             // Save the feature use change
             const updatedFeaturesForSave = characterState.features.map(f =>
                 f.name === featureName ? { ...f, currentUses: newUses } : f
             );
             updateCharacterData({ features: updatedFeaturesForSave });

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
          characterState.features.forEach(feature => {
              if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                  usesReset[feature.name] = feature.maxUses;
              }
          });
          const newFeatureUses = { ...featureUses, ...usesReset }; // Combine existing and reset uses
          setFeatureUses(newFeatureUses); // Update local UI state immediately

         try {
            setIsSaving(true);
             const updatedFeaturesWithUses = characterState.features.map(f => {
                 const currentLocalUse = newFeatureUses[f.name];
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
            // Update local state after successful save
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
             // Consider reverting featureUses state here if save fails
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
         characterState.features.forEach(feature => {
             if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 usesReset[feature.name] = feature.maxUses;
             }
         });
         setFeatureUses(usesReset); // Reset all tracked uses to max

        try {
           setIsSaving(true);
            const updatedFeaturesWithUses = characterState.features.map(f => {
                if (usesReset[f.name] !== undefined) {
                    return { ...f, currentUses: usesReset[f.name] };
                }
                return f;
            });
           await updateCharacter(characterState.id, {
               hitPoints: newHp,
               hitDice: newHitDice,
               features: updatedFeaturesWithUses,
            });
           // Update local state after successful save
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
              // Consider reverting featureUses state here if save fails
         } finally {
            setIsSaving(false);
         }
    };


  // --- Render ---

  return (
    <>
         {/* dddice Roller Component */}
         {diceRollResult && <DDDiceRoller key={rollerKey} resultText={diceRollResult} />}

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
                              <CardDescription>Base Score (Modifier)</CardDescription>
                           </CardHeader>
                           <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {Object.entries(characterState.stats).map(([name, baseValue]) => {
                                  const derivedValue = derivedStats[name as keyof typeof derivedStats];
                                  const modifierValue = modifiers[name as keyof typeof modifiers];
                                  const modifierString = modifierValue >= 0 ? `+${modifierValue}` : `${modifierValue}`;
                                  return (
                                      <div key={name} className="text-center p-3 border rounded-md bg-secondary/30 relative pt-6">
                                          <Label className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{name}</Label>
                                          <div className="relative mt-1">
                                              <div className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                                  {derivedValue} {/* Display derived score */}
                                              </div>
                                              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                                                  {modifierString} {/* Display derived modifier */}
                                              </div>
                                          </div>
                                           <div className="text-[0.6rem] text-muted-foreground h-3 mt-1">
                                                (Base: {baseValue}) {/* Show base score */}
                                            </div>
                                      </div>
                                  );
                              })}
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
                                <CardContent className="space-y-1">
                                    {ALL_SKILLS.map((skill) => {
                                        const proficient = !!characterState.skills[skill];
                                        const ability = SKILL_ABILITY_MAP[skill];
                                        const modifier = skillModifiers[skill]; // Use pre-calculated skill modifiers
                                        const modifierString = modifier >= 0 ? `+${modifier}` : `${modifier}`;

                                        return (
                                            <div key={skill} className="flex items-center justify-between p-1 rounded hover:bg-secondary/50 group">
                                                <div className="flex items-center gap-2">
                                                    {proficient ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted" />}
                                                    <Label className="capitalize text-sm font-normal flex-grow w-[100px] truncate" title={skill}>
                                                        {skill}
                                                        <span className='text-xs text-muted-foreground ml-1'>({ability.substring(0, 3)})</span>
                                                    </Label>
                                                </div>
                                                <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     className="h-7 px-2 text-sm font-medium text-primary hover:bg-primary/10"
                                                     onClick={() => handleSkillCheck(skill)}
                                                     title={`Roll ${skill} check (1d20 ${modifierString})`}
                                                >
                                                    {modifierString}
                                                </Button>
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
                                         {/* TODO: Better speed calculation based on race/features */}
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
                                        const hitBonusString = hitBonus >= 0 ? `+${hitBonus}` : `${hitBonus}`;
                                        const damageBonusString = damageBonus >= 0 ? `+${damageBonus}` : `${damageBonus}`;
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
                                                    <Button size="sm" variant="outline" onClick={() => handleAttackRoll(weapon.name, hitBonus)} title={`Roll 1d20 ${hitBonusString}`}>
                                                        <Dices className="mr-2 h-4 w-4" />
                                                        Hit: {hitBonusString}
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleDamageRoll(weapon.name, weapon.damageDice, damageBonus)} title={`Roll ${weapon.damageDice ?? '?'} ${damageBonusString}`}>
                                                        <Dices className="mr-2 h-4 w-4" />
                                                        Dmg: {weapon.damageDice ?? 'N/A'} {damageBonusString}
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
                                                    <p className='text-xs text-muted-foreground pl-6'>
                                                        {(typeof feature.description === 'string' && feature.description.length > 0) ? feature.description.split('.')[0] + '.' : ''}
                                                    </p>

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
                                    {typeof characterState.appearance === 'string' ? characterState.appearance : 'No description provided.'}
                                </p>
                             </div>
                             <Separator />
                            <div>
                                <h3 className='font-semibold mb-2'>Backstory</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[150px]">
                                    {typeof characterState.backstory === 'string' ? characterState.backstory : 'No description provided.'}
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
             constitutionModifier={modifiers.constitution} // Pass derived modifier
             maxHp={characterState.hitPoints.max}
             currentHp={characterState.hitPoints.current}
             onConfirm={handleShortRest}
             rollDiceFn={rollDice} // Pass the central rollDice function
         />
    </>
  );
}
