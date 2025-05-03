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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Trash2, ShieldCheck, Swords, ChevronUp, ChevronDown, BedDouble, BedSingle, HeartPulse, Edit, CheckSquare, Square, AlertCircle, Loader2, Wand2 } from 'lucide-react'; // Added Wand2
import { useToast } from '@/hooks/use-toast';
import {
    getAvailableEquipmentItems,
    getLevelUpOptions,
    getSpells, // Added getSpells
} from '@/services/dnd-api';
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, FeatureEffectMetadata, Spell } from '@/lib/types'; // Import Spell
import { updateCharacter, loadCharacter } from '@/services/character-service';
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog';
import { rollDice, SKILL_ABILITY_MAP, calculateSkillModifier, ALL_SKILLS, SPELL_SLOTS_BY_LEVEL } from '@/lib/types'; // Use central utils/types, added SPELL_SLOTS_BY_LEVEL
import Link from 'next/link'; // For Edit button
import { applyFeatureRules } from '@/services/feature-service'; // Import feature rule application
import { addGameLogEntry } from '@/services/campaign-service'; // Import campaign service
import { useAuth } from './auth-provider'; // Import useAuth
import { DDDiceRoller } from './dddice-roller'; // Import dddice roller
import { useDiceRoller } from './dice-roll-context'; // Import useDiceRoller hook

interface CharacterSheetProps {
    initialCharacter: Character; // Base character data is now passed in
}

export function CharacterSheet({ initialCharacter }: CharacterSheetProps) {
    const { toast } = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, userProfile } = useAuth(); // Get user info for logging
    const { triggerVisualRoll } = useDiceRoller(); // Use the dice roller context

    // --- State Management ---
    // Use react-query to manage character data, refetching when needed
    const { data: characterData, isLoading: isLoadingCharacter, error: characterError, refetch } = useQuery<Character | null, Error>({
         queryKey: ['character', initialCharacter.id],
         // Fetch function applies feature rules AFTER loading base data
         queryFn: async () => {
             const baseData = await loadCharacter(initialCharacter.id);
             if (!baseData) return null;
             return applyFeatureRules(baseData); // Apply rules to get derived state
         },
         initialData: initialCharacter, // Use passed initial data until first fetch
         staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
         refetchOnWindowFocus: false, // Optional: disable refetch on focus
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);

    // Derived state for feature uses - synchronized with query data
    const [featureUses, setFeatureUses] = useState<Record<string, number>>({});
    // Derived state for spell slot uses - synchronized with query data
     const [spellSlotsRemaining, setSpellSlotsRemaining] = useState<Record<string, number>>({});


    useEffect(() => {
        // Update local feature uses state when characterData (from query) changes
        if (characterData?.features) {
             const initialUses: Record<string, number> = {};
             characterData.features.forEach(feature => {
                if (feature.maxUses !== null && feature.maxUses !== undefined) {
                    // Prioritize currentUses if available, otherwise default to maxUses
                    initialUses[feature.name] = feature.currentUses ?? feature.maxUses;
                }
            });
            setFeatureUses(initialUses);
        }
        // Update local spell slot uses state
        if (characterData?.spellcasting?.slots) {
            const initialSlots: Record<string, number> = {};
             Object.entries(characterData.spellcasting.slots).forEach(([level, slotInfo]) => {
                initialSlots[level] = slotInfo.remaining;
            });
            setSpellSlotsRemaining(initialSlots);
        }
    }, [characterData?.features, characterData?.spellcasting?.slots]); // Dependencies updated


    // --- Derived Values (Calculated from characterData) ---

    // Get derived stats directly from the query data (already processed by applyFeatureRules)
    const derivedStats = useMemo(() => characterData?.stats || initialCharacter.stats, [characterData, initialCharacter.stats]);

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
        queryKey: ['levelData', characterData?.class, characterData?.level],
        queryFn: () => getLevelUpOptions(characterData!.class, characterData!.level), // Assert non-null as it depends on characterData
        enabled: !!characterData?.class && (characterData?.level ?? 0) > 0,
        staleTime: Infinity,
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);

    const spellSaveDC = useMemo(() => characterData?.spellcasting?.spellSaveDC ?? 0, [characterData?.spellcasting]);
    const spellAttackBonus = useMemo(() => characterData?.spellcasting?.spellAttackBonus ?? 0, [characterData?.spellcasting]);


    const allFeaturesAndTraits = useMemo(() => characterData?.features ?? [], [characterData?.features]);

    // --- Data Fetching for Definitions (Dropdowns, Item Details, Spells) ---
    const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
        queryKey: ['availableEquipment'],
        queryFn: () => getAvailableEquipmentItems(), // Assuming this uses combined content internally if needed
        staleTime: 60 * 60 * 1000,
    });

    // Fetch available spells (needed for displaying spell details)
    const { data: availableSpells = [], isLoading: isLoadingSpells } = useQuery<Spell[], Error>({
        queryKey: ['availableSpells'], // Might need campaign context if spells vary
        queryFn: () => getSpells(), // Assuming this fetches all relevant spells
        staleTime: Infinity,
    });

    // --- Memoized Calculations (Using derived stats/modifiers) ---

     const armorClass = useMemo(() => {
         if (!characterData) return 10; // Default AC if no data

         let baseAC = 10;
         let dexModForAC = modifiers.dexterity;
         let maxDex: number | null = null;
         let hasShield = false;
         let armorEquipped = false;
         let unarmoredDefenseValue: number | null = null;

         // Check equipped armor first
         characterData.equipment
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

         // Check for Unarmored Defense features and apply IF conditions met
         characterData.features.forEach(f => {
             const metadata = f.metadata as FeatureEffectMetadata | undefined; // Type cast
             if (metadata?.effectType === 'acCalculation') {
                 const isBarb = f.name.includes('Barbarian');
                 const isMonk = f.name.includes('Monk');
                  // Apply Barbarian UD if no armor worn (shield allowed)
                 if (isBarb && !armorEquipped && unarmoredDefenseValue === null) {
                     unarmoredDefenseValue = 10 + modifiers.dexterity + modifiers.constitution;
                     console.log("Barbarian Unarmored Defense applicable:", unarmoredDefenseValue);
                 }
                 // Apply Monk UD if no armor and no shield worn
                  else if (isMonk && !armorEquipped && !hasShield && unarmoredDefenseValue === null) {
                     unarmoredDefenseValue = 10 + modifiers.dexterity + modifiers.wisdom;
                     console.log("Monk Unarmored Defense applicable:", unarmoredDefenseValue);
                 }
             }
         });

         // Determine final AC calculation method
         if (unarmoredDefenseValue !== null) {
             baseAC = unarmoredDefenseValue;
             dexModForAC = 0; // Modifier already included in the formula
             console.log("Using Unarmored Defense AC:", baseAC);
         } else if (!armorEquipped){
             baseAC = 10; // Default unarmored
             dexModForAC = modifiers.dexterity;
             console.log("Using Default Unarmored AC:", baseAC, "+ DEX");
         } else {
            console.log("Using Armor Base AC:", baseAC);
         }


         // Apply Max Dex Bonus from armor
         if (maxDex !== null) {
             dexModForAC = Math.min(dexModForAC, maxDex);
         }

         // Calculate AC before direct bonuses
         let finalAC = baseAC + dexModForAC + (hasShield ? 2 : 0); // Standard shield bonus = 2
         console.log("AC before feature bonuses:", finalAC, `(Base: ${baseAC}, DexMod: ${dexModForAC}, Shield: ${hasShield ? 2 : 0})`);

         // Apply direct AC bonuses from features (e.g., Fighting Style: Defense)
         characterData.features.forEach(f => {
             const metadata = f.metadata as FeatureEffectMetadata | undefined;
             if (metadata?.effectType === 'acBonus') {
                  const conditionMet = metadata.condition === 'wearing armor' ? armorEquipped : true; // Simple check
                  if (conditionMet) {
                     finalAC += metadata.value;
                     console.log(`Applying AC bonus from ${f.name}: +${metadata.value}`);
                  }
             }
         });

          console.log("Final Calculated AC:", finalAC);
         return finalAC;
     }, [characterData, modifiers]);


    const equippedWeapons = useMemo(() => characterData?.equipment.filter(item => item.isEquipped && item.type === 'Weapon') ?? [], [characterData?.equipment]);
    const actionableFeatures = useMemo(() =>
        allFeaturesAndTraits
            .filter(f => f.isActionable)
            .map(f => ({
                 ...f,
                 currentUses: featureUses[f.name] ?? f.maxUses ?? undefined
            }))
    , [allFeaturesAndTraits, featureUses]);

    // Get Known/Prepared Spells
    const knownOrPreparedSpells = useMemo(() => {
        if (!characterData || !availableSpells.length) return {};
        const spells: Record<number, Spell[]> = {}; // Key is spell level
        const spellList = characterData.spellsPrepared || characterData.spellsKnown || [];

        spellList.forEach(spellName => {
            const spellData = availableSpells.find(s => s.name === spellName);
            if (spellData) {
                if (!spells[spellData.level]) {
                    spells[spellData.level] = [];
                }
                spells[spellData.level].push(spellData);
            }
        });
        // Sort spells within each level alphabetically
        Object.values(spells).forEach(levelSpells => levelSpells.sort((a, b) => a.name.localeCompare(b.name)));
        return spells;
    }, [characterData, availableSpells]);



    const isProficientWith = useCallback((item: EquipmentItem): boolean => {
        if (!characterData?.proficiencies) return false;

        if (item.type === 'Weapon') {
            if (characterData.proficiencies.weapons.includes(item.name)) return true;
            if (item.weaponCategory) {
                const categories = item.weaponCategory.split(' ');
                 if (characterData.proficiencies.weapons.some(p => categories.includes(p) || p === item.weaponCategory)) {
                    return true;
                }
            }

        } else if (item.type === 'Armor') {
            if (!item.armorCategory) return true; // Items like clothes don't require proficiency
             if (characterData.proficiencies.armor.includes(item.name)) return true;
            if (characterData.proficiencies.armor.includes(item.armorCategory)) return true;
        }
        return false;
    }, [characterData?.proficiencies]);


    const getHitBonus = useCallback((weapon: EquipmentItem): number => {
        let abilityMod = modifiers.strength;
        const isFinesse = weapon.properties?.includes('Finesse');

        if (isFinesse && modifiers.dexterity > modifiers.strength) {
            abilityMod = modifiers.dexterity;
        } else if (weapon.weaponCategory?.includes('Ranged')) {
             abilityMod = modifiers.dexterity;
        }
        const proficiencyMod = isProficientWith(weapon) ? proficiencyBonus : 0;
        let fightingStyleBonus = 0;
        if (weapon.weaponCategory?.includes('Ranged') && characterData?.features.some(f => f.name === 'Fighting Style: Archery')) {
            fightingStyleBonus = 2;
        }
        return abilityMod + proficiencyMod + fightingStyleBonus;
    }, [modifiers.strength, modifiers.dexterity, proficiencyBonus, isProficientWith, characterData?.features]);


    const getDamageBonus = useCallback((weapon: EquipmentItem): number => {
         let abilityMod = modifiers.strength;
         const isFinesse = weapon.properties?.includes('Finesse');
         const isTwoHanded = weapon.properties?.includes('Two-Handed');
         const isHeldInOneHand = true; // Simplified: Assume one hand unless logic added

         if (isFinesse && modifiers.dexterity > modifiers.strength) {
             abilityMod = modifiers.dexterity;
         } else if (weapon.weaponCategory?.includes('Ranged') && !weapon.properties?.some(p => p.toLowerCase().includes('thrown'))) {
              abilityMod = modifiers.dexterity;
         }

         let fightingStyleBonus = 0;
          if (characterData?.features.some(f => f.name === 'Fighting Style: Dueling') && isHeldInOneHand && !equippedWeapons.some(w => w.isEquipped && w.name !== weapon.name)) {
            fightingStyleBonus += 2; // Dueling bonus
         }
         // Add other bonuses (Two-Weapon Fighting applied during off-hand attack)

         return abilityMod + fightingStyleBonus;
    }, [modifiers.strength, modifiers.dexterity, characterData?.features, isProficientWith, equippedWeapons]);


    // Calculated skill modifiers using derived stats
    const skillModifiers = useMemo(() => {
        const mods: Record<string, number> = {};
        ALL_SKILLS.forEach(skill => {
            const proficient = !!characterData?.skills[skill];
            mods[skill] = calculateSkillModifier(skill, derivedStats, proficient, proficiencyBonus);
        });
        return mods;
    }, [derivedStats, characterData?.skills, proficiencyBonus]);


   // --- Update Functions ---

    const updateCharacterData = async (updates: Partial<Character>) => {
        if (!characterData) return; // Exit if character data isn't loaded

        setIsSaving(true);
        const dataToSave: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>> = {};

        // Only include fields that were actually changed and are persistable
        if ('hitPoints' in updates && updates.hitPoints && JSON.stringify(updates.hitPoints) !== JSON.stringify(characterData.hitPoints)) {
            dataToSave.hitPoints = updates.hitPoints;
        }
        if ('hitDice' in updates && updates.hitDice && JSON.stringify(updates.hitDice) !== JSON.stringify(characterData.hitDice)) {
            dataToSave.hitDice = updates.hitDice;
        }
        if ('equipment' in updates && updates.equipment && JSON.stringify(updates.equipment) !== JSON.stringify(characterData.equipment)) {
            dataToSave.equipment = updates.equipment;
        }
         if ('spellcasting' in updates && updates.spellcasting && JSON.stringify(updates.spellcasting) !== JSON.stringify(characterData.spellcasting)) {
            dataToSave.spellcasting = updates.spellcasting;
        }
        if ('features' in updates && updates.features) {
             dataToSave.features = updates.features.map(f => ({
                 name: f.name, description: f.description, source: f.source, metadata: f.metadata, isActionable: f.isActionable, maxUses: f.maxUses, usesResetOn: f.usesResetOn, currentUses: f.currentUses,
             }));
        }
        // Only update known/prepared spells if they are explicitly in the updates object
        if ('spellsKnown' in updates) dataToSave.spellsKnown = updates.spellsKnown;
        if ('spellsPrepared' in updates) dataToSave.spellsPrepared = updates.spellsPrepared;


        try {
            if (Object.keys(dataToSave).length > 0) {
                 console.log("Updating character with:", dataToSave);
                 await updateCharacter(characterData.id, dataToSave);
                 queryClient.invalidateQueries({ queryKey: ['character', characterData.id] });
                 toast({ title: "Character Updated", description: "Changes saved successfully." });
            } else {
                // toast({ title: "No Changes Detected", description: "No data needed saving." }); // Optional: Be less noisy
            }
        } catch (error) {
            console.error("Failed to update character:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes." });
        } finally {
            setIsSaving(false);
        }
    };


    // --- Event Handlers ---

     const handleHitPointChange = (type: 'current' | 'temporary', value: string) => {
         if (!characterData) return;
         const numValue = parseInt(value, 10);
         const maxHp = characterData.hitPoints.max;
         let newHpState: HitPointsState | null = null;

         if (!isNaN(numValue)) {
             newHpState = { ...characterData.hitPoints };
             if (type === 'current') {
                 newHpState.current = Math.max(0, Math.min(numValue, maxHp));
             } else {
                 newHpState.temporary = Math.max(0, numValue);
             }
         } else if (value === '') { // Allow clearing the input
             newHpState = { ...characterData.hitPoints };
             newHpState[type] = 0;
         }

         if (newHpState) {
             updateCharacterData({ hitPoints: newHpState });
         }
     };


    const handleToggleEquip = (itemName: string) => {
        if (!characterData) return;
        const newEquipment = characterData.equipment.map(item =>
            item.name === itemName
                ? { ...item, isEquipped: !item.isEquipped }
                : item
        );
        updateCharacterData({ equipment: newEquipment }); // Save the change
    };

    const handleAddEquipment = (itemToAdd: EquipmentItem) => {
        if (!characterData) return;
         const existingItemIndex = characterData.equipment.findIndex(item => item.name === itemToAdd.name);
         let newEquipment;
         if (existingItemIndex > -1) {
             newEquipment = characterData.equipment.map((item, index) =>
                index === existingItemIndex
                    ? { ...item, quantity: (item.quantity || 1) + (itemToAdd.quantity || 1) }
                    : item
            );
         } else {
            newEquipment = [...characterData.equipment, { ...itemToAdd, quantity: itemToAdd.quantity || 1, isEquipped: false }];
         }
         updateCharacterData({ equipment: newEquipment }); // Save the change
    };

    const handleRemoveEquipment = (itemName: string) => {
         if (!characterData) return;
        const newEquipment = characterData.equipment.filter(item => item.name !== itemName);
        updateCharacterData({ equipment: newEquipment }); // Save the change
    };

     const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
          if (!characterData) return;
         const newQuantity = Math.max(0, quantity);
         const newEquipment = characterData.equipment
            .map(item =>
                item.name === itemName ? { ...item, quantity: newQuantity } : item
            ).filter(item => item.quantity > 0);
        updateCharacterData({ equipment: newEquipment }); // Save the change
    }

    // --- Dice Rolling Handler (Generic) ---
    const performRoll = async (diceString: string, label: string) => {
       try {
           const roll = rollDice(diceString); // Use the utility function for calculation
           triggerVisualRoll(diceString, `${label}: ${roll}`); // Trigger the visual dddice roll

           // Log the roll to the game log
           if (characterData?.campaignId && user) {
               await addGameLogEntry({
                   campaignId: characterData.campaignId,
                   actorId: user.uid, // Or characterData.id ?
                   actorName: userProfile?.displayName || characterData.playerName || 'Player',
                   actionType: 'roll',
                   details: `${characterData.characterName} rolled ${label}: ${roll} (${diceString})`,
                   rollDetails: { dice: diceString, result: roll },
               });
           } else {
               console.warn("Could not log dice roll: Missing campaignId or user info");
           }

           toast({
               title: `${label} Roll`,
               description: `Result: ${roll}`,
           });
           return roll; // Return the numerical result
       } catch (error) {
           console.error("Error during dice roll:", error);
           toast({ variant: "destructive", title: "Roll Error", description: "Failed to roll dice." });
           return 0; // Return 0 on error
       }
    };


    // --- Action Handlers ---
    const handleAttackRoll = (weaponName: string, hitBonus: number) => {
        performRoll(`1d20+${hitBonus}`, `${weaponName} Attack`);
    };

    const handleDamageRoll = async (weaponName: string, damageDice: string | undefined, damageBonus: number) => {
       if (!damageDice) {
           toast({ variant: "destructive", title: "Damage Roll Error", description: `No damage dice defined for ${weaponName}.` });
           return;
       }
       // Check for Great Weapon Fighting style reroll
       let finalRoll = 0;
       let rollDescription = damageDice;
       const hasGWF = characterData?.features.some(f => f.name === 'Fighting Style: Great Weapon Fighting');
       const isTwoHanded = equippedWeapons.find(w => w.name === weaponName)?.properties?.includes('Two-Handed');

       if (hasGWF && isTwoHanded) {
           // Complex reroll logic needed here based on the damageDice string (e.g., "2d6")
           // Simplified: just roll normally for now
           finalRoll = rollDice(damageDice); // Roll the base dice
           // TODO: Implement GWF reroll logic properly
       } else {
           finalRoll = rollDice(damageDice); // Roll the base dice
       }

       const totalDamage = Math.max(0, finalRoll + damageBonus);
       performRoll(`${finalRoll}+${damageBonus}`, `${weaponName} Damage`); // Trigger visual roll and log

       // // Display toast (might be redundant if performRoll shows one)
       // toast({ title: `${weaponName} Damage`, description: `Rolled ${finalRoll} (${rollDescription}) + ${damageBonus} = ${totalDamage}` });
    };

     const handleSkillCheck = (skillName: string) => {
         const modifier = skillModifiers[skillName.toLowerCase()];
         performRoll(`1d20+${modifier}`, `${skillName.charAt(0).toUpperCase() + skillName.slice(1)} Check`);
     };


     const handleUseFeature = async (featureName: string) => {
          if (!characterData) return;
         const feature = characterData.features.find(f => f.name === featureName);
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
             if (characterData?.campaignId && user) {
                await addGameLogEntry({
                   campaignId: characterData.campaignId,
                   actorId: user.uid,
                   actorName: userProfile?.displayName || characterData.playerName,
                   actionType: 'featureUse',
                   details: `${characterData.characterName} used ${featureName}.`,
                });
             }
             return;
         }

         if (currentUses > 0) {
             const newUses = currentUses - 1;
             // Update local UI state immediately for feedback
             setFeatureUses(prev => ({ ...prev, [featureName]: newUses }));

             toast({
                 title: `Used ${featureName}`,
                 description: `${newUses} uses remaining.`,
             });

             // Prepare data for saving
             const updatedFeaturesForSave = characterData.features.map(f =>
                 f.name === featureName ? { ...f, currentUses: newUses } : f
             );

              // Special handling for features like Second Wind that affect HP
              let hpUpdates: Partial<Character> = {};
              if (featureName === 'Second Wind') {
                   // Roll 1d10 for healing
                  const healingRoll = rollDice('1d10');
                  const healing = healingRoll + characterData.level;
                  const newHpState = {
                     ...characterData.hitPoints,
                     current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + healing)
                  }
                  hpUpdates = { hitPoints: newHpState };
                  // Trigger visual roll for Second Wind healing dice
                  triggerVisualRoll('1d10', 'Second Wind Healing');
                  toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
              }

              // Save HP changes (if any) and feature use change
             await updateCharacterData({ ...hpUpdates, features: updatedFeaturesForSave });
              if (characterData?.campaignId && user) {
                 await addGameLogEntry({
                     campaignId: characterData.campaignId,
                     actorId: user.uid,
                     actorName: userProfile?.displayName || characterData.playerName,
                     actionType: 'featureUse',
                     details: `${characterData.characterName} used ${featureName} (${newUses}/${feature.maxUses} remaining).${hpUpdates.hitPoints ? ` Healed for ${hpUpdates.hitPoints.current - characterData.hitPoints.current} HP.` : ''}`,
                 });
             }
             return; // Exit early as updateCharacterData handles save and refetch

         } else {
             toast({
                 variant: "destructive",
                 title: `Cannot Use ${featureName}`,
                 description: "No uses remaining.",
             });
         }
     };

    // --- Spellcasting Handlers ---
    const handleCastSpell = async (spellName: string, level: number) => {
        if (!characterData?.spellcasting || !characterData?.spellcasting?.slots[level]) return;

        const currentSlots = spellSlotsRemaining[level] ?? characterData.spellcasting.slots[level].remaining;

        if (currentSlots > 0) {
             const newRemaining = currentSlots - 1;
            // Update local state
             setSpellSlotsRemaining(prev => ({ ...prev, [level]: newRemaining }));

            // Prepare data for saving
             const updatedSlots = { ...characterData.spellcasting.slots };
             updatedSlots[level] = { ...updatedSlots[level], remaining: newRemaining };
             const updatedSpellcasting = { ...characterData.spellcasting, slots: updatedSlots };

             // Save change
            await updateCharacterData({ spellcasting: updatedSpellcasting });

            // Log spell cast
             if (characterData?.campaignId && user) {
                 await addGameLogEntry({
                     campaignId: characterData.campaignId,
                     actorId: user.uid,
                     actorName: userProfile?.displayName || characterData.playerName,
                     actionType: 'spellCast',
                     details: `${characterData.characterName} cast ${spellName} using a level ${level} slot (${newRemaining} / ${characterData.spellcasting.slots[level].max} remaining).`,
                     spellDetails: { name: spellName, level: level },
                 });
             }

             toast({ title: `Cast ${spellName}`, description: `Used a level ${level} spell slot.` });

        } else {
             toast({ variant: "destructive", title: `Cannot Cast ${spellName}`, description: `No level ${level} spell slots remaining.` });
        }
    };


    // --- Rest Handlers ---
    const handleShortRest = async (hitDiceSpent: number, hpRecovered: number) => {
         if (!characterData) return;

         const newHp: HitPointsState = {
             ...characterData.hitPoints,
             current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + hpRecovered),
         };
         const newHitDice: HitDiceState = {
             ...characterData.hitDice,
             remaining: Math.max(0, characterData.hitDice.remaining - hitDiceSpent),
         };

         // Determine which features reset and update their currentUses
          const usesReset: Record<string, number> = {};
          characterData.features.forEach(feature => {
              if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                  usesReset[feature.name] = feature.maxUses; // Reset to max
              }
          });

          // Combine existing uses with reset uses
          const newFeatureUsesMap = { ...featureUses, ...usesReset };

          // Prepare the features array with updated currentUses for saving
           const updatedFeaturesWithUses = characterData.features.map(f => ({
               ...f,
               currentUses: newFeatureUsesMap[f.name] ?? f.currentUses, // Update if reset, else keep current
           }));

          // Update local UI immediately
          setFeatureUses(newFeatureUsesMap);

         // Save changes to DB
         await updateCharacterData({
             hitPoints: newHp,
             hitDice: newHitDice,
             features: updatedFeaturesWithUses,
         });
         // Log rest
          if (characterData?.campaignId && user) {
                 await addGameLogEntry({
                     campaignId: characterData.campaignId,
                     actorId: user.uid,
                     actorName: userProfile?.displayName || characterData.playerName,
                     actionType: 'statusChange',
                     details: `${characterData.characterName} took a Short Rest. Recovered ${hpRecovered} HP. Spent ${hitDiceSpent} Hit Dice.`,
                 });
          }
     };

    const handleLongRest = async () => {
         if (!characterData) return;

        const hitDiceToRegain = Math.max(1, Math.floor(characterData.hitDice.total / 2));
        const newCurrentHitDice = Math.min(characterData.hitDice.total, characterData.hitDice.remaining + hitDiceToRegain);

        const newHp: HitPointsState = {
            ...characterData.hitPoints,
            current: characterData.hitPoints.max,
            temporary: 0,
        };
         const newHitDice: HitDiceState = {
            ...characterData.hitDice,
            remaining: newCurrentHitDice,
        };

        // Reset all features that have uses and reset spell slots
         const usesReset: Record<string, number> = {};
         const slotsReset: Record<string, { max: number; remaining: number }> = {};

         characterData.features.forEach(feature => {
             if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 usesReset[feature.name] = feature.maxUses; // Reset to max
             }
         });
         // Reset spell slots to max
         if(characterData.spellcasting?.slots) {
            Object.entries(characterData.spellcasting.slots).forEach(([level, slotInfo]) => {
                slotsReset[level] = { ...slotInfo, remaining: slotInfo.max };
            });
         }

         // Prepare features with reset uses for saving
         const updatedFeaturesWithUses = characterData.features.map(f => ({
             ...f,
             currentUses: usesReset[f.name] ?? f.currentUses, // Update if reset, else keep current
         }));
        const updatedSpellcasting = characterData.spellcasting ? { ...characterData.spellcasting, slots: slotsReset } : undefined;

          // Update local UI immediately
          setFeatureUses(usesReset);
          setSpellSlotsRemaining(Object.fromEntries(Object.entries(slotsReset).map(([lvl, info]) => [lvl, info.remaining])));


         // Save changes to DB
         await updateCharacterData({
             hitPoints: newHp,
             hitDice: newHitDice,
             features: updatedFeaturesWithUses,
             spellcasting: updatedSpellcasting,
          });
           // Log rest
           if (characterData?.campaignId && user) {
                 await addGameLogEntry({
                     campaignId: characterData.campaignId,
                     actorId: user.uid,
                     actorName: userProfile?.displayName || characterData.playerName,
                     actionType: 'statusChange',
                     details: `${characterData.characterName} took a Long Rest. HP restored. Regained ${hitDiceToRegain} Hit Dice. Features/Spells refreshed.`,
                 });
           }
    };


  // --- Render ---

   if (isLoadingCharacter) {
      return (
         <div className="p-4 md:p-6 space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Skeleton className="h-64 w-full" />
               <Skeleton className="h-96 w-full" />
               <Skeleton className="h-80 w-full" />
            </div>
         </div>
      )
   }

   if (characterError) {
      return (
         <div className="p-4 md:p-6">
             <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error Loading Character</AlertTitle>
                 <AlertDescription>{characterError.message}</AlertDescription>
             </Alert>
         </div>
      )
   }

    if (!characterData) {
      return (
         <div className="p-4 md:p-6">
             <Alert>
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Character Not Found</AlertTitle>
                 <AlertDescription>The character could not be loaded.</AlertDescription>
             </Alert>
         </div>
      )
   }

  return (
    <>
        {/* DDDice Roller (Visual) */}
        <DDDiceRoller />

        <ScrollArea className="h-full p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Card */}
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <h1 className="text-2xl font-bold">{characterData.characterName}</h1>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <span>Class: {characterData.class}</span>
                             <span>Race: {characterData.race}</span>
                             <span>Level: {characterData.level}</span>
                             <span>Background: {characterData.background}</span>
                             <span>Player: {characterData.playerName}</span>
                             <span>Alignment: {characterData.alignment}</span>
                         </div>
                     </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" asChild>
                           <Link href={`/character/edit/${characterData.id}`}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Character
                           </Link>
                        </Button>
                         <Button variant="outline" size="sm" onClick={() => setIsShortRestDialogOpen(true)} disabled={isSaving}>
                             <BedSingle className="mr-2 h-4 w-4" /> Short Rest
                         </Button>
                         <Button variant="default" size="sm" onClick={handleLongRest} disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              <BedDouble className="mr-2 h-4 w-4" /> Long Rest
                         </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Main Content Grid */}
            <Tabs defaultValue="core" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-4"> {/* Updated cols */}
                    <TabsTrigger value="core">Core</TabsTrigger>
                    <TabsTrigger value="combat">Combat</TabsTrigger>
                     <TabsTrigger value="spells">Spells</TabsTrigger> {/* Added Spells Tab */}
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
                              <CardDescription>Score (Modifier)</CardDescription>
                           </CardHeader>
                           <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {Object.entries(derivedStats).map(([name, derivedValue]) => {
                                  const baseValue = initialCharacter.stats[name as keyof typeof initialCharacter.stats]; // Get base value
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
                                        const proficient = !!characterData.skills[skill]; // Check proficiency from derived data
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
                                         <div className="text-3xl font-bold mt-1">{characterData.race === 'Dwarf' ? '25 ft' : '30 ft'}</div>
                                     </div>
                                    <div className="col-span-3 border rounded-md p-3 bg-secondary/30">
                                          <Label className="text-xs uppercase text-muted-foreground flex items-center justify-center gap-1"><HeartPulse className='inline h-3 w-3' /> Hit Points</Label>
                                          <div className="flex justify-center items-center gap-2 mt-1">
                                               <Input
                                                   type="number"
                                                   value={characterData.hitPoints.current}
                                                   onChange={(e) => handleHitPointChange('current', e.target.value)}
                                                   className="w-20 text-center text-lg font-semibold"
                                                   aria-label="Current Hit Points"
                                                   max={characterData.hitPoints.max}
                                                   min={0}
                                                   disabled={isSaving}
                                               />
                                               <span className="text-muted-foreground">/</span>
                                                <span className="w-20 text-center text-lg font-semibold">{characterData.hitPoints.max}</span>
                                          </div>
                                           {characterData.hitPoints.temporary > 0 && (
                                                <div className='flex items-center justify-center gap-2 mt-1'>
                                                     <Label htmlFor='temp-hp' className='text-xs text-blue-400'>Temp HP:</Label>
                                                      <Input
                                                         id='temp-hp'
                                                         type="number"
                                                         value={characterData.hitPoints.temporary}
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
                                                <p className='text-sm font-medium'>{characterData.hitDice.remaining} / {characterData.hitDice.total} ({characterData.hitDice.dieType || 'N/A'})</p>
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
                                                        {/* <Dices className="mr-2 h-4 w-4" /> Replaced with SVG */}
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M17.1 3.1C16.5 2.5 15.5 2 14 2H6C4.9 2 4 2.9 4 4v8c0 1.5 2.5 2.9 3.1 3.5c0.6 0.6 1.5 1 3 1h8c1.1 0 2-0.9 2-2v-8C22 5.5 19.5 3.1 18.9 2.5z"/><path d="M17 11h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H17c0.3 0 0.5-0.2 0.5-0.5S17.3 11 17 11z"/><path d="M14 8h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H14c0.3 0 0.5-0.2 0.5-0.5S14.3 8 14 8z"/><path d="M11 5h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H11c0.3 0 0.5-0.2 0.5-0.5S11.3 5 11 5z"/></svg>
                                                        Hit: {hitBonusString}
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleDamageRoll(weapon.name, weapon.damageDice, damageBonus)} title={`Roll ${weapon.damageDice ?? '?'} ${damageBonusString}`}>
                                                         {/* <Dices className="mr-2 h-4 w-4" /> Replaced with SVG */}
                                                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M17.1 3.1C16.5 2.5 15.5 2 14 2H6C4.9 2 4 2.9 4 4v8c0 1.5 2.5 2.9 3.1 3.5c0.6 0.6 1.5 1 3 1h8c1.1 0 2-0.9 2-2v-8C22 5.5 19.5 3.1 18.9 2.5z"/><path d="M17 11h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H17c0.3 0 0.5-0.2 0.5-0.5S17.3 11 17 11z"/><path d="M14 8h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H14c0.3 0 0.5-0.2 0.5-0.5S14.3 8 14 8z"/><path d="M11 5h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H11c0.3 0 0.5-0.2 0.5-0.5S11.3 5 11 5z"/></svg>
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

                {/* Spells Tab */}
                 <TabsContent value="spells">
                    <Card className="bg-card/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Spellcasting</CardTitle>
                             {characterData.spellcasting ? (
                                 <CardDescription className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                                     <span>Ability: <Badge variant="secondary">{characterData.spellcasting.ability?.toUpperCase()}</Badge></span>
                                     <span>Save DC: <Badge variant="secondary">{spellSaveDC}</Badge></span>
                                     <span>Attack Bonus: <Badge variant="secondary">+{spellAttackBonus}</Badge></span>
                                     {/* <span>Prepared/Known: X/Y</span> Add logic if needed */}
                                 </CardDescription>
                             ) : (
                                 <CardDescription>This character does not have spellcasting abilities.</CardDescription>
                             )}
                        </CardHeader>
                        <CardContent>
                             {!characterData.spellcasting ? (
                                 <p className="text-sm text-muted-foreground text-center py-4">No spellcasting features found.</p>
                             ) : (
                                <ScrollArea className="h-[500px] w-full pr-4">
                                    <Accordion type="multiple" className="w-full space-y-2">
                                         {/* Cantrips (Level 0) */}
                                         {knownOrPreparedSpells[0] && knownOrPreparedSpells[0].length > 0 && (
                                            <AccordionItem value="level-0" className="border rounded-md px-4 bg-secondary/30">
                                                <AccordionTrigger className='text-lg font-semibold hover:no-underline'>Cantrips</AccordionTrigger>
                                                <AccordionContent className="pt-2 pb-4 space-y-3">
                                                    {knownOrPreparedSpells[0].map(spell => (
                                                        <div key={spell.name} className='border-b pb-2 last:border-0'>
                                                            <p className='font-medium'>{spell.name} <span className='text-xs text-muted-foreground'>({spell.school})</span></p>
                                                            <p className='text-xs text-muted-foreground'>Cast Time: {spell.castingTime}, Range: {spell.range}, Duration: {spell.duration}</p>
                                                            <p className='text-xs mt-1'>{spell.description}</p>
                                                            {/* Add button for spell attack/save if applicable */}
                                                        </div>
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                         )}
                                         {/* Leveled Spells */}
                                         {Object.entries(characterData.spellcasting.slots).sort(([lvlA], [lvlB]) => parseInt(lvlA) - parseInt(lvlB)).map(([level, slotInfo]) => {
                                             const spellsForLevel = knownOrPreparedSpells[parseInt(level)] || [];
                                             if (slotInfo.max === 0) return null; // Skip levels with no slots
                                             const currentSlots = spellSlotsRemaining[level] ?? slotInfo.remaining; // Use local state for display

                                             return (
                                                <AccordionItem value={`level-${level}`} key={`level-${level}`} className="border rounded-md px-4 bg-secondary/30">
                                                    <AccordionTrigger className='text-lg font-semibold hover:no-underline'>
                                                         Level {level} Spells ({currentSlots} / {slotInfo.max} Slots)
                                                     </AccordionTrigger>
                                                    <AccordionContent className="pt-2 pb-4 space-y-3">
                                                         {spellsForLevel.length === 0 ? (
                                                             <p className='text-sm italic text-muted-foreground'>No level {level} spells known/prepared.</p>
                                                         ) : (
                                                             spellsForLevel.map(spell => (
                                                                <div key={spell.name} className='border-b pb-2 last:border-0 flex justify-between items-start gap-2'>
                                                                    <div className='flex-grow'>
                                                                         <p className='font-medium'>{spell.name} <span className='text-xs text-muted-foreground'>({spell.school})</span></p>
                                                                         <p className='text-xs text-muted-foreground'>Cast Time: {spell.castingTime}, Range: {spell.range}, Duration: {spell.duration}</p>
                                                                         <p className='text-xs mt-1'>{spell.description}</p>
                                                                          {spell.higherLevel && <p className='text-xs mt-1 text-blue-400'><em>At Higher Levels:</em> {spell.higherLevel}</p>}
                                                                     </div>
                                                                      <Button
                                                                         variant="default"
                                                                         size="sm"
                                                                         className='mt-1 shrink-0'
                                                                         onClick={() => handleCastSpell(spell.name, spell.level)}
                                                                         disabled={currentSlots <= 0 || isSaving}
                                                                     >
                                                                         <Wand2 className="mr-2 h-4 w-4"/> Cast
                                                                     </Button>
                                                                 </div>
                                                             ))
                                                         )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                             );
                                         })}
                                    </Accordion>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                 </TabsContent>

                {/* Inventory Tab */}
                <TabsContent value="inventory">
                    <Card className="bg-card/80 backdrop-blur-sm">
                       <CardHeader className="flex flex-row items-center justify-between pb-2">
                           <CardTitle>Equipment</CardTitle>
                           <Button variant="ghost" size="icon" onClick={() => setIsAddEquipmentOpen(true)} aria-label="Add Equipment" disabled={isSaving || isLoadingEquipment}>
                               <PlusCircle className="h-5 w-5" />
                           </Button>
                       </CardHeader>
                       <CardContent>
                           {characterData.equipment.length === 0 ? (
                               <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet.</p>
                           ) : (
                               <ScrollArea className="h-[400px] w-full">
                                   <ul className="space-y-2 pr-4">
                                       {characterData.equipment.map((item, index) => (
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
                                    {characterData.appearance || 'No description provided.'}
                                </p>
                             </div>
                             <Separator />
                            <div>
                                <h3 className='font-semibold mb-2'>Backstory</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[150px]">
                                     {characterData.backstory || 'No description provided.'}
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
             maxHitDice={characterData.hitDice.total}
             currentHitDice={characterData.hitDice.remaining}
             hitDieType={characterData.hitDice.dieType}
             constitutionModifier={modifiers.constitution} // Pass derived modifier
             maxHp={characterData.hitPoints.max}
             currentHp={characterData.hitPoints.current}
             onConfirm={handleShortRest}
             rollDiceFn={performRoll} // Pass the performRoll function which uses dddice
         />
    </>
  );
}
