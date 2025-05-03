'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dices, WandSparkles, Heart, Shield, PlusCircle, Trash2, Info, AlertCircle, ChevronUp, ChevronDown, Play, Square, RotateCcw, Users, ScrollText, LogOut, Settings, ShieldCheck, BookOpen, Bot, Swords, UserRoundCog, UserPlus, Pencil } from 'lucide-react'; // Added missing icons

import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, Spell, SourcePack } from '@/lib/types';
import { SKILL_ABILITY_MAP, ALL_SKILLS } from '@/lib/types'; // Import constants

import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useDiceRoller } from '@/components/dice-roll-context';
import { AddEquipmentDialog } from '@/components/add-equipment-dialog'; // Added import

// Import Server Actions
import {
    loadCharacterAction,
    updateCharacterAction,
    takeShortRestAction,
    takeLongRestAction,
    useFeatureAction,
    castSpellAction
} from '@/app/actions/character-actions';
import {
    calculateAbilityModifierAction,
    calculateSkillModifierAction,
    calculateArmorClassAction,
    calculateHitBonusAction,
    calculateDamageBonusAction,
    calculateSpellSaveDCAction,
    calculateSpellAttackBonusAction,
    calculateMaxHitPointsAction
} from '@/app/actions/rules-actions';
import {
    getAvailableEquipmentItemsAction,
    getSpellsAction
} from '@/app/actions/dnd-api-actions'; // Added D&D API action import

// Import Child Components
import { CharacterSheetHeader } from './character-sheet/character-sheet-header';
import { CharacterVitalsSection } from './character-sheet/character-vitals-section';
import { CharacterStatsSection } from './character-sheet/character-stats-section';
import { CharacterSkillsSection } from './character-sheet/character-skills-section';
import { CharacterProficienciesLanguages } from './character-sheet/character-proficiencies-languages';
import { CharacterActionsSection } from './character-sheet/character-actions-section';
import { CharacterEquipmentInventory } from './character-sheet/character-equipment-inventory';
import { CharacterFeaturesTraits } from './character-sheet/character-features-traits';
import { CharacterSpellsSection } from './character-sheet/character-spells-section';
import { CharacterDetailsSection } from './character-sheet/character-details-section';

interface CharacterSheetProps {
    initialCharacter: Character;
}

export function CharacterSheet({ initialCharacter }: CharacterSheetProps) {
    const [character, setCharacter] = useState<Character>(initialCharacter);
    const [availableItems, setAvailableItems] = useState<EquipmentItem[]>([]);
    const [allSpells, setAllSpells] = useState<Spell[]>([]); // State for all spells
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false); // State for save operations
    const { toast } = useToast();
    const { user } = useAuth();

    // Derived State Calculation (moved outside useEffect where possible)
    const proficiencyBonus = useMemo(() => (
        character.level >= 17 ? 6 :
        character.level >= 13 ? 5 :
        character.level >= 9 ? 4 :
        character.level >= 5 ? 3 : 2
    ), [character.level]);

    // Basic AC Calculation (can be enhanced with rules engine results)
    const calculatedAC = useMemo(() => {
        let ac = 10; // Base unarmored
        const dexMod = Math.floor(((character.stats?.dexterity ?? 10) - 10) / 2);
        let armorDexMod = dexMod;
        let maxDex: number | null = null;
        let hasShield = false;
        let armorEquipped = false;

        character.equipment?.forEach(item => {
             if (item.isEquipped && item.type === 'Armor') {
                if (item.armorCategory === 'Shield') {
                    hasShield = true;
                } else if (!armorEquipped && item.baseAC !== undefined) {
                    ac = item.baseAC;
                    if (item.addDexModifier === false) armorDexMod = 0;
                    maxDex = item.maxDexBonus ?? null;
                    armorEquipped = true;
                }
             }
        });

        // Simple check for Defense fighting style
        const hasDefenseStyle = character.features?.some(f => f.name === 'Fighting Style: Defense');
        if (hasDefenseStyle && armorEquipped) {
            ac += 1;
        }

        // Unarmored Defense (simplified check)
        const hasBarbarianDefense = character.features?.some(f => f.name === 'Unarmored Defense (Barbarian)');
        const hasMonkDefense = character.features?.some(f => f.name === 'Unarmored Defense (Monk)');

        if (!armorEquipped) {
            if (hasBarbarianDefense) {
                const conMod = Math.floor(((character.stats?.constitution ?? 10) - 10) / 2);
                ac = 10 + dexMod + conMod;
                armorDexMod = 0; // Already included
            } else if (hasMonkDefense && !hasShield) {
                const wisMod = Math.floor(((character.stats?.wisdom ?? 10) - 10) / 2);
                ac = 10 + dexMod + wisMod;
                 armorDexMod = 0; // Already included
            } else {
                // No armor, no special defense - apply dex mod
                ac = 10; // Reset to base 10
                armorDexMod = dexMod;
            }
        }

        if (maxDex !== null) armorDexMod = Math.min(armorDexMod, maxDex);
        ac += armorDexMod;
        if (hasShield) ac += 2;

        return ac;
    }, [character.stats, character.equipment, character.features]);

    // Initiative Bonus
    const initiativeBonus = useMemo(() => Math.floor(((character.stats?.dexterity ?? 10) - 10) / 2), [character.stats?.dexterity]);

    // Base Speed (assuming race definition provides it, or default)
    // TODO: Fetch race definition if needed or have baseSpeed stored
    const baseSpeed = 30; // Placeholder

    // Passive Perception
    const passivePerception = useMemo(() => {
        const wisMod = Math.floor(((character.stats?.wisdom ?? 10) - 10) / 2);
        const perceptionProficient = !!character.skills?.perception;
        const perceptionBonus = wisMod + (perceptionProficient ? proficiencyBonus : 0);
        return 10 + perceptionBonus;
    }, [character.stats?.wisdom, character.skills?.perception, proficiencyBonus]);

     // Saving Throw Modifiers
     const savingThrows = useMemo(() => {
         return (Object.keys(character.stats) as Array<keyof typeof character.stats>).map(stat => {
             const score = character.stats[stat];
             const modifier = Math.floor((score - 10) / 2);
             const isProficient = character.proficiencies?.savingThrows?.includes(stat);
             return {
                 stat,
                 bonus: modifier + (isProficient ? proficiencyBonus : 0),
                 proficient: !!isProficient
             };
         });
     }, [character.stats, character.proficiencies?.savingThrows, proficiencyBonus]);


    // Fetch available items and spells on mount or when campaign context changes
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [itemsResult, spellsResult] = await Promise.all([
                    getAvailableEquipmentItemsAction(character.campaignId),
                    getSpellsAction(character.campaignId)
                ]);

                if (itemsResult.success) {
                    setAvailableItems(itemsResult.items);
                } else {
                    console.error("Failed to load equipment items:", itemsResult.error);
                    setError("Failed to load equipment definitions.");
                }

                if (spellsResult.success) {
                    setAllSpells(spellsResult.spells);
                } else {
                    console.error("Failed to load spells:", spellsResult.error);
                     setError(prev => prev ? `${prev} Failed to load spell definitions.` : "Failed to load spell definitions.");
                }
            } catch (err) {
                console.error("Error fetching sheet data:", err);
                setError("Could not load necessary game data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [character.campaignId]); // Re-fetch if campaign changes


    // Function to handle character updates from child components or actions
    const handleCharacterUpdate = useCallback((updatedCharacterData: Partial<Character> | Character | null) => {
        if (updatedCharacterData === null) {
            // Handle potential null case (e.g., if load fails after update)
             console.warn("Received null character update, potentially from a failed reload.");
             // Decide if you want to revert or show an error
             // For now, just log it.
            return;
        }
        setCharacter(prev => ({ ...prev, ...updatedCharacterData }));
    }, []);


    // Debounced save function for HP/TempHP/HitDice
    const saveVitals = useCallback(async (updates: Partial<Character>) => {
         if (!user || user.uid !== character.playerId) return;
         setIsSaving(true);
         try {
             const result = await updateCharacterAction(character.id, updates, user.uid);
             if (!result.success) {
                 throw new Error(result.error || 'Failed to save vitals.');
             }
             // Optimistic update already happened via setCharacter
             // Maybe refresh full character state occasionally or upon specific actions
             toast({ title: "Vitals Saved", duration: 2000 });
         } catch (error: any) {
             console.error("Error saving vitals:", error);
             toast({ variant: "destructive", title: "Save Failed", description: error.message });
             // TODO: Revert optimistic update? Or trigger a full refresh?
             // For now, just show error. Consider reloading character on error.
         } finally {
             setIsSaving(false);
         }
    }, [character.id, character.playerId, user, toast]); // Include dependencies


     // Specific handlers for vitals with debouncing (or immediate save)
     const handleHpChange = (newHp: number) => {
         const cappedHp = Math.max(0, Math.min(character.hitPoints.max, newHp));
         setCharacter(prev => ({ ...prev, hitPoints: { ...prev.hitPoints, current: cappedHp } }));
         saveVitals({ hitPoints: { ...character.hitPoints, current: cappedHp } });
     };

     const handleTempHpChange = (newTempHp: number) => {
          const cappedTempHp = Math.max(0, newTempHp);
          setCharacter(prev => ({ ...prev, hitPoints: { ...prev.hitPoints, temporary: cappedTempHp } }));
          saveVitals({ hitPoints: { ...character.hitPoints, temporary: cappedTempHp } });
     };

    const handleHitDiceChange = (newRemaining: number) => {
        if (character.hitDice) {
            const cappedRemaining = Math.max(0, Math.min(character.hitDice.total, newRemaining));
             setCharacter(prev => ({ ...prev, hitDice: { ...prev.hitDice!, remaining: cappedRemaining } }));
            saveVitals({ hitDice: { ...character.hitDice, remaining: cappedRemaining } });
        }
    };

     // Handlers for Short/Long Rest Actions
     const handleShortRest = async () => {
         if (!user || user.uid !== character.playerId) return;
         // TODO: Add UI to select hit dice to spend
         const hitDiceToSpend = 0; // Placeholder - needs input
         if (hitDiceToSpend > (character.hitDice?.remaining ?? 0)) {
              toast({ variant: "destructive", title: "Not Enough Hit Dice", description: `You only have ${character.hitDice?.remaining} hit dice remaining.` });
              return;
         }
         setIsLoading(true);
         try {
             const result = await takeShortRestAction(character.id, user.uid, hitDiceToSpend);
             if (result.success && result.character) {
                 handleCharacterUpdate(result.character);
                 toast({ title: "Short Rest Taken", description: "Recovered HP and features." });
             } else {
                 throw new Error(result.error || 'Failed to take short rest.');
             }
         } catch (error: any) {
             console.error("Short Rest Error:", error);
             toast({ variant: "destructive", title: "Short Rest Failed", description: error.message });
         } finally {
             setIsLoading(false);
         }
     };

     const handleLongRest = async () => {
         if (!user || user.uid !== character.playerId) return;
         setIsLoading(true);
         try {
             const result = await takeLongRestAction(character.id, user.uid);
             if (result.success && result.character) {
                 handleCharacterUpdate(result.character);
                 toast({ title: "Long Rest Taken", description: "Fully recovered HP, hit dice, and features." });
             } else {
                 throw new Error(result.error || 'Failed to take long rest.');
             }
         } catch (error: any) {
             console.error("Long Rest Error:", error);
             toast({ variant: "destructive", title: "Long Rest Failed", description: error.message });
         } finally {
             setIsLoading(false);
         }
     };

    // --- Render Logic ---
    if (isLoading) {
        return <CharacterSheetSkeleton />;
    }

    if (error) {
        return (
            <div className="p-4 md:p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Character Data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card>
                 <CharacterSheetHeader
                     characterName={character.characterName}
                     playerName={character.playerName}
                     level={character.level}
                     race={character.race}
                     characterClass={character.class} // Assuming single class display for header
                     alignment={character.alignment}
                     background={character.background}
                 />
            </Card>

             {/* Rest Buttons */}
             <div className="flex justify-end space-x-2">
                 <Button variant="outline" size="sm" onClick={handleShortRest} disabled={isLoading || isSaving}>
                      Short Rest
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleLongRest} disabled={isLoading || isSaving}>
                      Long Rest
                 </Button>
             </div>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Vitals, Stats, Skills */}
                <div className="space-y-4 lg:col-span-1">
                     <CharacterVitalsSection
                        hitPoints={character.hitPoints}
                        hitDice={character.hitDice}
                        armorClass={calculatedAC}
                        speed={baseSpeed} // Use calculated/fetched speed
                        initiativeBonus={initiativeBonus}
                        proficiencyBonus={proficiencyBonus}
                        passivePerception={passivePerception}
                        onHpChange={handleHpChange}
                        onTempHpChange={handleTempHpChange}
                        onHitDiceChange={handleHitDiceChange}
                    />
                     <CharacterStatsSection stats={character.stats} proficiencyBonus={proficiencyBonus} />
                     <CharacterSkillsSection
                         characterName={character.characterName}
                         stats={character.stats}
                         skillsProficiency={character.skills}
                         proficiencyBonus={proficiencyBonus}
                     />
                </div>

                {/* Column 2: Actions, Equipment */}
                <div className="space-y-4 lg:col-span-1">
                     <CharacterActionsSection
                        character={character}
                        onCharacterUpdate={handleCharacterUpdate}
                     />
                     <CharacterProficienciesLanguages
                         proficiencies={character.proficiencies}
                         savingThrows={savingThrows}
                         proficiencyBonus={proficiencyBonus}
                         passivePerception={passivePerception}
                     />
                     <CharacterEquipmentInventory
                         characterId={character.id}
                         playerId={character.playerId}
                         equipment={character.equipment}
                         availableItems={availableItems}
                         isLoadingItems={isLoading}
                         onCharacterUpdate={handleCharacterUpdate}
                    />
                </div>

                {/* Column 3: Features, Spells, Details */}
                <div className="space-y-4 lg:col-span-1">
                     <CharacterFeaturesTraits
                        features={character.features}
                        featureChoices={character.featureChoices}
                     />
                     {character.spellcasting && (
                        <CharacterSpellsSection
                            characterId={character.id}
                            playerId={character.playerId}
                            spellcasting={character.spellcasting}
                            spellsKnown={character.spellsKnown || []}
                            spellsPrepared={character.spellsPrepared}
                            allSpells={allSpells} // Pass fetched spells
                            onCharacterUpdate={handleCharacterUpdate}
                         />
                     )}
                    <CharacterDetailsSection
                        appearance={character.appearance}
                        backstory={character.backstory}
                    />
                </div>
            </div>
        </div>
    );
}

// Skeleton component for loading state
function CharacterSheetSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card><CardHeader><Skeleton className="h-20 w-full" /></CardHeader></Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 lg:col-span-1">
          <Card><CardHeader><CardTitle>Vitals</CardTitle></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card><CardHeader><CardTitle>Stats</CardTitle></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
          <Card><CardHeader><CardTitle>Skills</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
        <div className="space-y-4 lg:col-span-1">
          <Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
           <Card><CardHeader><CardTitle>Proficiencies</CardTitle></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
          <Card><CardHeader><CardTitle>Equipment</CardTitle></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
        <div className="space-y-4 lg:col-span-1">
          <Card><CardHeader><CardTitle>Features</CardTitle></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}
