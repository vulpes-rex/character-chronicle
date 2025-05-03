
// @ts-nocheck - Disabling TypeScript checks for rapid prototyping
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Added useRouter
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, AlertCircle, Loader2 } from 'lucide-react'; // Removed Bed icons
import { useToast } from '@/hooks/use-toast';
import { getAvailableEquipmentItems, getSpells } from '@/services/dnd-api'; // Keep definition getters
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, Spell } from '@/lib/types'; // Import Spell
import { updateCharacter, loadCharacter } from '@/services/character-service';
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog';
import { rollDice } from '@/lib/types'; // Keep base rollDice for now
import { addGameLogEntry } from '@/services/campaign-service'; // Import campaign service
import { useAuth } from './auth-provider'; // Import useAuth
import { useDiceRoller } from './dice-roll-context'; // Import useDiceRoller hook
import { calculateAbilityModifier, calculateArmorClass, calculateHitBonus, calculateDamageBonus, calculateSpellSaveDC, calculateSpellAttackBonus, calculateMaxHitPoints } from '@/services/rules-service'; // Import calculation functions
import { getCombinedContentFromPacks } from '@/services/campaign-service'; // Needed for content context

// Import sub-components
import { CharacterHeader } from './character-sheet/character-header';
import { CharacterStats } from './character-sheet/character-stats';
import { CharacterSkills } from './character-sheet/character-skills';
import { CharacterFeatures } from './character-sheet/character-features';
import { CharacterCombatStats } from './character-sheet/character-combat-stats';
import { CharacterActions } from './character-sheet/character-actions';
import { CharacterSpellcasting } from './character-sheet/character-spellcasting';
import { CharacterInventory } from './character-sheet/character-inventory';
import { CharacterPersonality } from './character-sheet/character-personality';
import { DDDiceRoller } from './dddice-roller'; // Import DDDice Roller


interface CharacterSheetProps {
    initialCharacter: Character;
}

export function CharacterSheet({ initialCharacter }: CharacterSheetProps) {
    const { toast } = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, userProfile } = useAuth();
    const { triggerVisualRoll } = useDiceRoller();

    // --- State Management ---
    // Use initialCharacter directly, refetch on updates/focus
    const { data: characterData, isLoading: isLoadingCharacter, error: characterError, refetch } = useQuery<Character | null, Error>({
        queryKey: ['character', initialCharacter.id],
        queryFn: () => loadCharacter(initialCharacter.id), // loadCharacter applies rules
        initialData: initialCharacter, // Use the server-fetched data initially
        staleTime: 1 * 60 * 1000, // Data is stale after 1 minute
        refetchOnWindowFocus: true,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);
    // Remove local featureUses and spellSlotsRemaining state, rely on characterData

    // --- Data Fetching for Definitions ---
    // Fetch combined content based on campaign (if available) or fallback to SRD
    const { data: combinedContent, isLoading: isLoadingContent } = useQuery({
        queryKey: ['combinedContent', characterData?.campaignId || 'srd-only'],
        queryFn: () => getCombinedContentFromPacks(characterData?.campaignId ? [characterData.campaignId] : ['srd']),
        enabled: !!characterData, // Only fetch when character data is available
        staleTime: 5 * 60 * 1000, // Cache content for 5 mins
    });

     const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
         queryKey: ['availableEquipment', combinedContent], // Depend on combined content
         queryFn: () => getAvailableEquipmentItems(combinedContent),
         enabled: !!combinedContent, // Fetch only when content is loaded
         staleTime: 60 * 60 * 1000,
     });

     const { data: availableSpells = [], isLoading: isLoadingSpells } = useQuery<Spell[], Error>({
         queryKey: ['availableSpells', combinedContent], // Depend on combined content
         queryFn: () => getSpells(combinedContent),
         enabled: !!combinedContent, // Fetch only when content is loaded
         staleTime: Infinity, // Spells are often static per source pack
     });


    // --- Derived Values (Using rules-service) ---
    const finalStats = useMemo(() => characterData?.stats || initialCharacter.stats, [characterData, initialCharacter.stats]);

    // Proficiency Bonus
    const proficiencyBonus = useMemo(() => {
        const level = characterData?.level ?? 1;
        if (level >= 17) return 6;
        if (level >= 13) return 5;
        if (level >= 9) return 4;
        if (level >= 5) return 3;
        return 2;
    }, [characterData?.level]);

    // AC, Spell Save DC, Spell Attack Bonus (Calculated Asynchronously)
    const [armorClass, setArmorClass] = useState(10);
    const [spellSaveDC, setSpellSaveDC] = useState(0);
    const [spellAttackBonus, setSpellAttackBonus] = useState(0);

    useEffect(() => {
        const calculateDerived = async () => {
            if (!characterData) return;
            setArmorClass(await calculateArmorClass(characterData));

            if (characterData.spellcasting?.ability) {
                const abilityScore = characterData.stats[characterData.spellcasting.ability] ?? 10;
                setSpellSaveDC(await calculateSpellSaveDC(proficiencyBonus, abilityScore));
                setSpellAttackBonus(await calculateSpellAttackBonus(proficiencyBonus, abilityScore));
            } else {
                setSpellSaveDC(0);
                setSpellAttackBonus(0);
            }
        };
        calculateDerived();
    }, [characterData, proficiencyBonus]); // Recalculate when character or proficiency bonus changes

    // Other derived data
    const allFeaturesAndTraits = useMemo(() => characterData?.features ?? [], [characterData?.features]);
    const equippedWeapons = useMemo(() => characterData?.equipment.filter(item => item.isEquipped && item.type === 'Weapon') ?? [], [characterData?.equipment]);
    const actionableFeatures = useMemo(() =>
        allFeaturesAndTraits.filter(f => f.isActionable),
        [allFeaturesAndTraits]
    );

    const knownOrPreparedSpells = useMemo(() => {
        if (!characterData || !availableSpells.length) return {};
        const spells: Record<number, Spell[]> = {};
        const spellList = characterData.spellsPrepared || characterData.spellsKnown || [];
        spellList.forEach(spellName => {
            const spellData = availableSpells.find(s => s.name === spellName);
            if (spellData) {
                if (!spells[spellData.level]) spells[spellData.level] = [];
                spells[spellData.level].push(spellData);
            }
        });
        Object.values(spells).forEach(levelSpells => levelSpells.sort((a, b) => a.name.localeCompare(b.name)));
        return spells;
    }, [characterData, availableSpells]);

    // --- Update Functions (Simplified - delegate complex logic) ---
    const updateCharacterState = useCallback(async (updates: Partial<Character>) => {
        if (!characterData) return;
        setIsSaving(true);

        try {
            // Only pass editable fields to updateCharacter
            const editableUpdates: Partial<Omit<Character, 'id' | 'createdAt'>> = {};
            if ('hitPoints' in updates) editableUpdates.hitPoints = updates.hitPoints;
            if ('hitDice' in updates) editableUpdates.hitDice = updates.hitDice;
            if ('equipment' in updates) editableUpdates.equipment = updates.equipment;
            if ('spellcasting' in updates && updates.spellcasting?.slots) {
                // We only update the 'remaining' slots part of spellcasting
                 const existingSlots = characterData.spellcasting?.slots || {};
                 const updatedSlots = { ...existingSlots };
                 Object.keys(updates.spellcasting.slots).forEach(level => {
                     if (updatedSlots[level]) {
                         updatedSlots[level] = {
                             ...updatedSlots[level],
                             remaining: updates.spellcasting!.slots![level].remaining,
                         };
                     }
                 });
                  editableUpdates.spellcasting = { ...characterData.spellcasting, slots: updatedSlots } as any; // Type assertion needed here
            }
             if ('features' in updates && updates.features) {
                 // Only update currentUses on the features
                 editableUpdates.features = characterData.features.map(baseFeature => {
                     const updatedFeature = updates.features!.find(f => f.name === baseFeature.name);
                     return updatedFeature ? { ...baseFeature, currentUses: updatedFeature.currentUses } : baseFeature;
                 });
             }

            if (Object.keys(editableUpdates).length > 0) {
                await updateCharacter(characterData.id, editableUpdates, user!.uid); // Pass user ID
                queryClient.invalidateQueries({ queryKey: ['character', characterData.id] });
                // Let the query refetch handle the UI update
                toast({ title: "Character Updated" });
            } else {
                toast({ title: "No changes detected", variant: "default" }); // Inform user if no actual update needed
            }
        } catch (error) {
            console.error("Failed to update character:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes." });
            // Optionally refetch to rollback optimistic updates if implemented
            // queryClient.invalidateQueries({ queryKey: ['character', characterData.id] });
        } finally {
            setIsSaving(false);
        }
    }, [characterData, queryClient, toast, user]); // Add user to dependencies

    // --- Event Handlers (Simplified - call updateCharacterState) ---
    const handleHitPointChange = (type: 'current' | 'temporary', value: string) => {
        if (!characterData?.hitPoints) return;
        const numValue = parseInt(value, 10);
        const maxHp = characterData.hitPoints.max;
        let newHpState: HitPointsState | null = null;

        if (!isNaN(numValue)) {
            newHpState = { ...characterData.hitPoints };
            if (type === 'current') newHpState.current = Math.max(0, Math.min(numValue, maxHp));
            else newHpState.temporary = Math.max(0, numValue);
        } else if (value === '') { // Handle empty input (treat as 0)
            newHpState = { ...characterData.hitPoints };
            newHpState[type] = 0;
        }

        if (newHpState && (newHpState.current !== characterData.hitPoints.current || newHpState.temporary !== characterData.hitPoints.temporary)) {
            updateCharacterState({ hitPoints: newHpState });
        }
    };

    const handleToggleEquip = (itemName: string) => {
        if (!characterData) return;
        const newEquipment = characterData.equipment.map(item =>
            item.name === itemName ? { ...item, isEquipped: !item.isEquipped } : item
        );
        updateCharacterState({ equipment: newEquipment });
    };

    const handleAddEquipment = (itemToAdd: EquipmentItem) => {
        if (!characterData) return;
        const existingItemIndex = characterData.equipment.findIndex(item => item.name === itemToAdd.name);
        let newEquipment;
        if (existingItemIndex > -1) {
            newEquipment = characterData.equipment.map((item, index) =>
                index === existingItemIndex ? { ...item, quantity: (item.quantity || 1) + (itemToAdd.quantity || 1) } : item
            );
        } else {
            newEquipment = [...characterData.equipment, { ...itemToAdd, quantity: itemToAdd.quantity || 1, isEquipped: false }];
        }
        updateCharacterState({ equipment: newEquipment });
    };

    const handleRemoveEquipment = (itemName: string) => {
        if (!characterData) return;
        const newEquipment = characterData.equipment.filter(item => item.name !== itemName);
        updateCharacterState({ equipment: newEquipment });
    };

    const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
        if (!characterData) return;
        const newQuantity = Math.max(0, quantity);
        if (isNaN(newQuantity)) return; // Ignore invalid input

        const newEquipment = characterData.equipment
            .map(item => item.name === itemName ? { ...item, quantity: newQuantity } : item)
            .filter(item => item.quantity > 0); // Remove items with 0 quantity
        updateCharacterState({ equipment: newEquipment });
    }

    const performRoll = useCallback(async (diceString: string, label: string) => {
        // Simple dice parsing (needs improvement for complex strings)
        const match = diceString.match(/(\d+)?d(\d+)([+-]\d+)?/i);
        let baseRollString = diceString;
        let modifier = 0;
        if (match) {
            baseRollString = `${match[1] || '1'}d${match[2]}`;
            modifier = parseInt(match[3] || '0', 10);
        }

        try {
            // Trigger visual roll first
            triggerVisualRoll(baseRollString, `${label}`);

            // Simulate waiting for roll result (replace with actual dddice result handling)
            const basicRollResult = rollDice(baseRollString); // Use basic roll for now
            const finalResult = basicRollResult + modifier;

            if (characterData?.campaignId && user) {
                await addGameLogEntry({
                    campaignId: characterData.campaignId,
                    actorId: user.uid,
                    actorName: userProfile?.displayName || characterData.playerName || 'Player',
                    actionType: 'roll',
                    details: `${characterData.characterName} rolled ${label}: ${finalResult} (${diceString})`,
                    rollDetails: { dice: diceString, result: finalResult },
                });
            }
            toast({ title: `${label} Roll`, description: `Result: ${finalResult}` });
            return finalResult; // Return the calculated result
        } catch (error) {
            console.error("Error during dice roll:", error);
            toast({ variant: "destructive", title: "Roll Error" });
            return 0; // Return 0 on error
        }
    }, [characterData, user, userProfile, triggerVisualRoll, toast]);

    const handleUseFeature = useCallback(async (featureName: string) => {
        if (!characterData) return;
        const featureIndex = characterData.features.findIndex(f => f.name === featureName);
        if (featureIndex === -1) return;

        const feature = characterData.features[featureIndex];
        const currentUses = feature.currentUses;

        if (feature.maxUses === null || feature.maxUses === undefined || currentUses === undefined || currentUses === null) {
            // Feature has unlimited uses or doesn't track uses
            toast({ title: `Used ${featureName}` });
            if (characterData?.campaignId && user) {
                await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName || 'Player', actionType: 'featureUse', details: `${characterData.characterName} used ${featureName}.` });
            }
            return;
        }

        if (currentUses > 0) {
            const newUses = currentUses - 1;
            const updatedFeatures = [...characterData.features];
            updatedFeatures[featureIndex] = { ...feature, currentUses: newUses };

             // Handle special feature effects like Second Wind
             let hpUpdates: Partial<Character> = {};
             if (featureName === 'Second Wind' && characterData.hitPoints) {
                 const healingRoll = await performRoll('1d10', 'Second Wind Healing Die');
                 // Assuming level is available directly on characterData
                 const healing = healingRoll + characterData.level;
                 const newHpState = { ...characterData.hitPoints, current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + healing) };
                 hpUpdates = { hitPoints: newHpState };
                 toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
             }

            // Pass only the changed features and HP updates to the state updater
            await updateCharacterState({ ...hpUpdates, features: updatedFeatures });
             if (characterData?.campaignId && user) {
                 const healAmount = hpUpdates.hitPoints ? hpUpdates.hitPoints.current - (characterData.hitPoints?.current || 0) : 0;
                 await addGameLogEntry({
                     campaignId: characterData.campaignId,
                     actorId: user.uid,
                     actorName: userProfile?.displayName || characterData.playerName || 'Player',
                     actionType: 'featureUse',
                     details: `${characterData.characterName} used ${featureName} (${newUses}/${feature.maxUses} remaining).${healAmount > 0 ? ` Healed for ${healAmount} HP.` : ''}`
                 });
             }
            // Toast is handled by updateCharacterState on success
        } else {
            toast({ variant: "destructive", title: `Cannot Use ${featureName}`, description: "No uses remaining." });
        }
    }, [characterData, toast, user, userProfile, updateCharacterState, performRoll]);


    const handleCastSpell = useCallback(async (spellName: string, level: number) => {
        if (!characterData?.spellcasting?.slots?.[level]) return;

        const slotInfo = characterData.spellcasting.slots[level];
        const currentSlots = slotInfo.remaining;

        if (currentSlots > 0) {
            const newRemaining = currentSlots - 1;
            const updatedSlots = { ...characterData.spellcasting.slots };
            updatedSlots[level] = { ...slotInfo, remaining: newRemaining };

            // Only update the spellcasting part of the character
            await updateCharacterState({ spellcasting: { ...characterData.spellcasting, slots: updatedSlots } });

            if (characterData?.campaignId && user) {
                 await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName || 'Player', actionType: 'spellCast', details: `${characterData.characterName} cast ${spellName} (Level ${level}). Slots remaining: ${newRemaining}/${slotInfo.max}` });
             }
            // Toast is handled by updateCharacterState on success
        } else {
            toast({ variant: "destructive", title: `Cannot Cast ${spellName}`, description: `No level ${level} spell slots remaining.` });
        }
    }, [characterData, toast, user, userProfile, updateCharacterState]);


    const handleShortRest = useCallback(async (hitDiceSpent: number, hpRecovered: number) => {
        if (!characterData) return;

        // Calculate new HP and HD state
        const newHp: HitPointsState = { ...characterData.hitPoints, current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + hpRecovered) };
        const newHitDice: HitDiceState = { ...characterData.hitDice, remaining: Math.max(0, characterData.hitDice.remaining - hitDiceSpent) };

        // Calculate feature uses to reset
        const updatedFeatures = characterData.features.map(feature => {
            if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                return { ...feature, currentUses: feature.maxUses };
            }
            return feature;
        });

        // Prepare the update payload
        const updates: Partial<Character> = {
             hitPoints: newHp,
             hitDice: newHitDice,
             features: updatedFeatures
        };

        // Apply updates
        await updateCharacterState(updates);
        if (characterData?.campaignId && user) {
             await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName || 'Player', actionType: 'statusChange', details: `${characterData.characterName} took a Short Rest. Recovered ${hpRecovered} HP using ${hitDiceSpent} Hit Dice.` });
         }
        // Toast is handled by updateCharacterState
    }, [characterData, user, userProfile, updateCharacterState]);

     const handleLongRest = useCallback(async () => {
        if (!characterData) return;

        // Calculate HD recovery
        const hitDiceToRegain = Math.max(1, Math.floor(characterData.hitDice.total / 2));
        const newCurrentHitDice = Math.min(characterData.hitDice.total, characterData.hitDice.remaining + hitDiceToRegain);

        // Reset HP and HD state
        const newHp: HitPointsState = { ...characterData.hitPoints, current: characterData.hitPoints.max, temporary: 0 };
        const newHitDice: HitDiceState = { ...characterData.hitDice, remaining: newCurrentHitDice };

        // Reset feature uses
        const updatedFeatures = characterData.features.map(feature => {
            if (feature.maxUses !== null && feature.maxUses !== undefined) {
                 return { ...feature, currentUses: feature.maxUses };
            }
            return feature;
        });

        // Reset spell slots
        let updatedSpellcasting = characterData.spellcasting;
        if (updatedSpellcasting?.slots) {
            const resetSlots = { ...updatedSpellcasting.slots };
            Object.keys(resetSlots).forEach(level => {
                resetSlots[level] = { ...resetSlots[level], remaining: resetSlots[level].max };
            });
            updatedSpellcasting = { ...updatedSpellcasting, slots: resetSlots };
        }

        // Prepare the update payload
        const updates: Partial<Character> = {
             hitPoints: newHp,
             hitDice: newHitDice,
             features: updatedFeatures,
             ...(updatedSpellcasting && { spellcasting: updatedSpellcasting }), // Only include spellcasting if it exists
        };

        // Apply updates
        await updateCharacterState(updates);
        if (characterData?.campaignId && user) {
             await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName || 'Player', actionType: 'statusChange', details: `${characterData.characterName} took a Long Rest.` });
         }
        // Toast handled by updateCharacterState
    }, [characterData, user, userProfile, updateCharacterState]);


    // --- Render Logic ---
    if (isLoadingCharacter && !characterData) { // Show skeleton only on initial load
        return <CharacterSheetSkeleton />;
    }

    if (characterError) {
        return <ErrorDisplay error={characterError} />;
    }

    if (!characterData) {
        return <NotFoundDisplay />;
    }

    // Base character data needed for displays comparing base vs derived
    const baseCharacter = initialCharacter; // Or could fetch base data separately if needed

    return (
        <>
            <DDDiceRoller /> {/* Render DDDice visual component */}
            <ScrollArea className="h-full p-4 md:p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <CharacterHeader
                        character={characterData}
                        onShortRest={() => setIsShortRestDialogOpen(true)}
                        onLongRest={handleLongRest}
                        isSaving={isSaving}
                    />

                    <Tabs defaultValue="core" className="w-full">
                        <TabsList className="grid w-full grid-cols-5 mb-4">
                            <TabsTrigger value="core">Core</TabsTrigger>
                            <TabsTrigger value="combat">Combat</TabsTrigger>
                            <TabsTrigger value="spells">Spells</TabsTrigger>
                            <TabsTrigger value="inventory">Inventory</TabsTrigger>
                            <TabsTrigger value="personality">Personality</TabsTrigger>
                        </TabsList>

                        <TabsContent value="core">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Pass base stats for comparison */}
                                <CharacterStats stats={finalStats} baseStats={baseCharacter.stats} />
                                <CharacterSkills character={characterData} proficiencyBonus={proficiencyBonus} onRoll={performRoll} />
                                {/* Pass characterData.features which includes currentUses */}
                                <CharacterFeatures features={allFeaturesAndTraits} uses={Object.fromEntries(characterData.features.map(f => [f.name, f.currentUses]))} />
                            </div>
                        </TabsContent>

                        <TabsContent value="combat">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <CharacterCombatStats
                                    armorClass={armorClass}
                                    dexterityScore={finalStats.dexterity} // Pass score for async calculation
                                    speed={`${characterData.race === 'Dwarf' ? 25 : 30} ft`} // Simplistic speed
                                    hitPoints={characterData.hitPoints}
                                    hitDice={characterData.hitDice}
                                    onHpChange={handleHitPointChange}
                                    isSaving={isSaving}
                                />
                                <div className="md:col-span-2">
                                    <CharacterActions
                                        weapons={equippedWeapons}
                                        features={actionableFeatures} // Pass features with currentUses from characterData
                                        character={characterData}
                                        proficiencyBonus={proficiencyBonus}
                                        onRoll={performRoll}
                                        onUseFeature={handleUseFeature}
                                        isSaving={isSaving}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="spells">
                             <CharacterSpellcasting
                                 spellcasting={characterData.spellcasting}
                                 spellSaveDC={spellSaveDC}
                                 spellAttackBonus={spellAttackBonus}
                                 spellsByLevel={knownOrPreparedSpells}
                                 // Pass remaining slots directly from characterData
                                 spellSlotsRemaining={Object.fromEntries(Object.entries(characterData.spellcasting?.slots || {}).map(([lvl, info]) => [lvl, info.remaining]))}
                                 onCastSpell={handleCastSpell}
                                 isSaving={isSaving}
                                 isLoadingSpells={isLoadingSpells}
                             />
                        </TabsContent>

                        <TabsContent value="inventory">
                            <CharacterInventory
                                equipment={characterData.equipment}
                                onToggleEquip={handleToggleEquip}
                                onUpdateQuantity={handleUpdateEquipmentQuantity}
                                onRemoveItem={handleRemoveEquipment}
                                onAddItemClick={() => setIsAddEquipmentOpen(true)}
                                isSaving={isSaving}
                                isLoadingEquipment={isLoadingEquipment}
                            />
                        </TabsContent>

                        <TabsContent value="personality">
                            <CharacterPersonality
                                appearance={characterData.appearance}
                                backstory={characterData.backstory}
                            />
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
                 constitutionModifier={calculateAbilityModifier(finalStats.constitution)} // Calculate mod directly
                 maxHp={characterData.hitPoints.max}
                 currentHp={characterData.hitPoints.current}
                 onConfirm={handleShortRest}
                 rollDiceFn={performRoll} // Pass the roll function
             />
        </>
    );
}

// --- Helper Loading/Error Components ---

function CharacterSheetSkeleton() {
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
    );
}

function ErrorDisplay({ error }: { error: Error }) {
    return (
        <div className="p-4 md:p-6">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Character</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
            </Alert>
        </div>
    );
}

function NotFoundDisplay() {
    return (
        <div className="p-4 md:p-6">
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Character Not Found</AlertTitle>
                <AlertDescription>The character could not be loaded.</AlertDescription>
            </Alert>
        </div>
    );
}

