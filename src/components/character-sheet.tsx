// @ts-nocheck - Disabling TypeScript checks for rapid prototyping
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Added useRouter
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, BedDouble, BedSingle, AlertCircle, Loader2, HeartPulse } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAvailableEquipmentItems, getSpells, getLevelUpOptions } from '@/services/dnd-api'; // Moved calculations to dnd-api
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, Spell } from '@/lib/types'; // Import Spell
import { updateCharacter, loadCharacter } from '@/services/character-service';
import { AddEquipmentDialog } from './add-equipment-dialog';
import { ShortRestDialog } from './short-rest-dialog';
import { rollDice, SKILL_ABILITY_MAP, ALL_SKILLS } from '@/lib/types'; // Use central utils/types
import Link from 'next/link'; // For Edit button
import { addGameLogEntry } from '@/services/campaign-service'; // Import campaign service
import { useAuth } from './auth-provider'; // Import useAuth
import { DDDiceRoller } from './dddice-roller';
import { useDiceRoller } from './dice-roll-context'; // Import useDiceRoller hook

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
import { calculateArmorClass } from '@/services/dnd-api'; // Import AC calculation

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
    const { data: characterData, isLoading: isLoadingCharacter, error: characterError, refetch } = useQuery<Character | null, Error>({
        queryKey: ['character', initialCharacter.id],
        queryFn: () => loadCharacter(initialCharacter.id),
        initialData: initialCharacter,
        staleTime: 1 * 60 * 1000, // Data is stale after 1 minute
        refetchOnWindowFocus: true,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [isShortRestDialogOpen, setIsShortRestDialogOpen] = useState(false);
    const [featureUses, setFeatureUses] = useState<Record<string, number>>({});
    const [spellSlotsRemaining, setSpellSlotsRemaining] = useState<Record<string, number>>({});

    // Effect to sync local state (uses, slots) with fetched character data
    useEffect(() => {
        if (characterData?.features) {
            const initialUses: Record<string, number> = {};
            characterData.features.forEach(feature => {
                if (feature.maxUses !== null && feature.maxUses !== undefined) {
                    initialUses[feature.name] = feature.currentUses ?? feature.maxUses;
                }
            });
            setFeatureUses(initialUses);
        }
        if (characterData?.spellcasting?.slots) {
            const initialSlots: Record<string, number> = {};
            Object.entries(characterData.spellcasting.slots).forEach(([level, slotInfo]) => {
                initialSlots[level] = slotInfo.remaining;
            });
            setSpellSlotsRemaining(initialSlots);
        }
    }, [characterData?.features, characterData?.spellcasting?.slots]);

    // --- Data Fetching for Definitions (Dropdowns, Item Details, Spells) ---
     const { data: availableEquipment = [], isLoading: isLoadingEquipment } = useQuery<EquipmentItem[], Error>({
         queryKey: ['availableEquipment', characterData?.campaignId], // Maybe include campaign ID if items are campaign specific?
         // Assume getAvailableEquipmentItems can potentially take campaign context if needed
         queryFn: () => getAvailableEquipmentItems(characterData?.campaignId ? [characterData.campaignId] : undefined),
         enabled: !!characterData,
         staleTime: 60 * 60 * 1000,
     });

     const { data: availableSpells = [], isLoading: isLoadingSpells } = useQuery<Spell[], Error>({
         queryKey: ['availableSpells', characterData?.campaignId], // Spells might depend on campaign sources
         // Assume getSpells can potentially take campaign context if needed
         queryFn: () => getSpells(characterData?.campaignId ? [characterData.campaignId] : undefined),
         enabled: !!characterData,
         staleTime: Infinity, // Spells are often static per source pack
     });


    // --- Derived Values (Using dnd-api for calculations) ---
    const derivedStats = useMemo(() => characterData?.stats || initialCharacter.stats, [characterData, initialCharacter.stats]);

    const modifiers = useMemo(() => ({
        strength: Math.floor((derivedStats.strength - 10) / 2),
        dexterity: Math.floor((derivedStats.dexterity - 10) / 2),
        constitution: Math.floor((derivedStats.constitution - 10) / 2),
        intelligence: Math.floor((derivedStats.intelligence - 10) / 2),
        wisdom: Math.floor((derivedStats.wisdom - 10) / 2),
        charisma: Math.floor((derivedStats.charisma - 10) / 2),
    }), [derivedStats]);

    const { data: levelData } = useQuery({
        queryKey: ['levelData', characterData?.class, characterData?.level],
        queryFn: () => getLevelUpOptions(characterData!.class, characterData!.level), // Use dnd-api
        enabled: !!characterData?.class && (characterData?.level ?? 0) > 0,
        staleTime: Infinity,
    });
    const proficiencyBonus = useMemo(() => levelData?.proficiencyBonus ?? 0, [levelData]);

    const spellSaveDC = useMemo(() => characterData?.spellcasting?.spellSaveDC ?? 0, [characterData?.spellcasting]);
    const spellAttackBonus = useMemo(() => characterData?.spellcasting?.spellAttackBonus ?? 0, [characterData?.spellcasting]);

    const armorClass = useMemo(() => characterData ? calculateArmorClass(characterData) : 10, [characterData]);

    const allFeaturesAndTraits = useMemo(() => characterData?.features ?? [], [characterData?.features]);
    const equippedWeapons = useMemo(() => characterData?.equipment.filter(item => item.isEquipped && item.type === 'Weapon') ?? [], [characterData?.equipment]);
    const actionableFeatures = useMemo(() =>
        allFeaturesAndTraits
            .filter(f => f.isActionable)
            .map(f => ({
                ...f,
                currentUses: featureUses[f.name] ?? f.maxUses ?? undefined
            })),
        [allFeaturesAndTraits, featureUses]
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

    // --- Update Functions ---
    const updateCharacterData = useCallback(async (updates: Partial<Character>) => {
        if (!characterData) return;
        setIsSaving(true);
        const dataToSave: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>> = {};

        // Only include fields that are directly updatable from the sheet
        if ('hitPoints' in updates) dataToSave.hitPoints = updates.hitPoints;
        if ('hitDice' in updates) dataToSave.hitDice = updates.hitDice;
        if ('equipment' in updates) dataToSave.equipment = updates.equipment;
        if ('spellcasting' in updates && updates.spellcasting?.slots && characterData.spellcasting?.slots) {
            const updatedSlots = Object.entries(characterData.spellcasting.slots).reduce((acc, [level, slotInfo]) => {
                acc[level] = {
                    max: slotInfo.max,
                    remaining: updates.spellcasting!.slots![level]?.remaining ?? slotInfo.remaining,
                };
                return acc;
            }, {} as Record<string, { max: number; remaining: number }>);
            dataToSave.spellcasting = { ...characterData.spellcasting, slots: updatedSlots };
        }
        if ('features' in updates && updates.features) {
             dataToSave.features = baseCharacter.features.map(baseFeature => {
                 const updatedFeature = updates.features!.find(f => f.name === baseFeature.name);
                 return { ...baseFeature, currentUses: updatedFeature?.currentUses ?? baseFeature.currentUses };
             });
        }

        try {
            if (Object.keys(dataToSave).length > 0) {
                 // Fetch the *base* character data before applying updates
                 // This ensures we don't accidentally overwrite non-updatable fields
                 const baseDataForUpdate = await loadCharacter(characterData.id, false); // false = don't apply rules
                 if (!baseDataForUpdate) throw new Error("Failed to load base character data before update.");

                 // Merge the intended updates onto the base data
                 const finalDataToSave = {
                    ...baseDataForUpdate, // Start with fetched base data
                    ...dataToSave,       // Apply the specific updates
                    // Don't spread characterData here as it contains derived values
                 };

                 // Remove derived fields just in case
                 delete finalDataToSave.spellcasting?.spellSaveDC;
                 delete finalDataToSave.spellcasting?.spellAttackBonus;

                await updateCharacter(characterData.id, finalDataToSave);
                queryClient.invalidateQueries({ queryKey: ['character', characterData.id] });
                toast({ title: "Character Updated" });
            }
        } catch (error) {
            console.error("Failed to update character:", error);
            toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes." });
        } finally {
            setIsSaving(false);
        }
    }, [characterData, queryClient, toast]); // Added baseCharacter dependency? careful

    // --- Event Handlers ---
    const handleHitPointChange = (type: 'current' | 'temporary', value: string) => {
        if (!characterData) return;
        const numValue = parseInt(value, 10);
        const maxHp = characterData.hitPoints.max;
        let newHpState: HitPointsState | null = null;

        if (!isNaN(numValue)) {
            newHpState = { ...characterData.hitPoints };
            if (type === 'current') newHpState.current = Math.max(0, Math.min(numValue, maxHp));
            else newHpState.temporary = Math.max(0, numValue);
        } else if (value === '') {
            newHpState = { ...characterData.hitPoints };
            newHpState[type] = 0;
        }
        if (newHpState) updateCharacterData({ hitPoints: newHpState });
    };

    const handleToggleEquip = (itemName: string) => {
        if (!characterData) return;
        const newEquipment = characterData.equipment.map(item =>
            item.name === itemName ? { ...item, isEquipped: !item.isEquipped } : item
        );
        updateCharacterData({ equipment: newEquipment });
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
        updateCharacterData({ equipment: newEquipment });
    };

    const handleRemoveEquipment = (itemName: string) => {
        if (!characterData) return;
        const newEquipment = characterData.equipment.filter(item => item.name !== itemName);
        updateCharacterData({ equipment: newEquipment });
    };

    const handleUpdateEquipmentQuantity = (itemName: string, quantity: number) => {
        if (!characterData) return;
        const newQuantity = Math.max(0, quantity);
        const newEquipment = characterData.equipment
            .map(item => item.name === itemName ? { ...item, quantity: newQuantity } : item)
            .filter(item => item.quantity > 0);
        updateCharacterData({ equipment: newEquipment });
    }

    const performRoll = useCallback(async (diceString: string, label: string) => {
        try {
            const rollResult = rollDice(diceString); // Use imported basic roll for now
            triggerVisualRoll(diceString, `${label}: ${rollResult}`);
            if (characterData?.campaignId && user) {
                await addGameLogEntry({
                    campaignId: characterData.campaignId,
                    actorId: user.uid,
                    actorName: userProfile?.displayName || characterData.playerName || 'Player',
                    actionType: 'roll',
                    details: `${characterData.characterName} rolled ${label}: ${rollResult} (${diceString})`,
                    rollDetails: { dice: diceString, result: rollResult },
                });
            }
            toast({ title: `${label} Roll`, description: `Result: ${rollResult}` });
            return rollResult;
        } catch (error) {
            console.error("Error during dice roll:", error);
            toast({ variant: "destructive", title: "Roll Error" });
            return 0;
        }
    }, [characterData, user, userProfile, triggerVisualRoll, toast]);

    const handleUseFeature = useCallback(async (featureName: string) => {
        if (!characterData) return;
        const feature = characterData.features.find(f => f.name === featureName);
        if (!feature) return;

        const currentUses = featureUses[featureName];
        if (feature.maxUses === null || feature.maxUses === undefined || currentUses === undefined || currentUses === null) {
            toast({ title: `Used ${featureName}` });
            if (characterData?.campaignId && user) { await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName, actionType: 'featureUse', details: `${characterData.characterName} used ${featureName}.` }); }
            return;
        }

        if (currentUses > 0) {
            const newUses = currentUses - 1;
            setFeatureUses(prev => ({ ...prev, [featureName]: newUses })); // Optimistic UI update
            toast({ title: `Used ${featureName}`, description: `${newUses} uses remaining.` });

            const updatedFeaturesForSave = characterData.features.map(f =>
                f.name === featureName ? { ...f, currentUses: newUses } : f
            );

             // Handle special feature effects like Second Wind
             let hpUpdates: Partial<Character> = {};
             if (featureName === 'Second Wind' && characterData.hitPoints) {
                 const healingRoll = await performRoll('1d10', 'Second Wind Healing Die');
                 const healing = healingRoll + characterData.level;
                 const newHpState = { ...characterData.hitPoints, current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + healing) };
                 hpUpdates = { hitPoints: newHpState };
                 toast({ title: 'Second Wind Healing', description: `Regained ${healing} hit points.` });
             }

            await updateCharacterData({ ...hpUpdates, features: updatedFeaturesForSave });
            if (characterData?.campaignId && user) { await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName, actionType: 'featureUse', details: `${characterData.characterName} used ${featureName} (${newUses}/${feature.maxUses} remaining).${hpUpdates.hitPoints ? ` Healed for ${hpUpdates.hitPoints.current - characterData.hitPoints.current} HP.` : ''}` }); }
        } else {
            toast({ variant: "destructive", title: `Cannot Use ${featureName}` });
        }
    }, [characterData, featureUses, toast, user, userProfile, updateCharacterData, performRoll]);

    const handleCastSpell = useCallback(async (spellName: string, level: number) => {
        if (!characterData?.spellcasting || !characterData?.spellcasting?.slots[level]) return;
        const currentSlots = spellSlotsRemaining[level] ?? characterData.spellcasting.slots[level].remaining;

        if (currentSlots > 0) {
            const newRemaining = currentSlots - 1;
            setSpellSlotsRemaining(prev => ({ ...prev, [level]: newRemaining }));
            const updatedSlots = { ...characterData.spellcasting.slots };
            updatedSlots[level] = { ...updatedSlots[level], remaining: newRemaining };
            await updateCharacterData({ spellcasting: { ...characterData.spellcasting, slots: updatedSlots } });

            if (characterData?.campaignId && user) { await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName, actionType: 'spellCast', details: `${characterData.characterName} cast ${spellName} (Level ${level}). Slots remaining: ${newRemaining}/${updatedSlots[level].max}` }); }
            toast({ title: `Cast ${spellName}` });
        } else {
            toast({ variant: "destructive", title: `Cannot Cast ${spellName}` });
        }
    }, [characterData, spellSlotsRemaining, toast, user, userProfile, updateCharacterData]);

    const handleShortRest = useCallback(async (hitDiceSpent: number, hpRecovered: number) => {
        if (!characterData) return;
        const newHp: HitPointsState = { ...characterData.hitPoints, current: Math.min(characterData.hitPoints.max, characterData.hitPoints.current + hpRecovered) };
        const newHitDice: HitDiceState = { ...characterData.hitDice, remaining: Math.max(0, characterData.hitDice.remaining - hitDiceSpent) };
        const usesReset: Record<string, number> = {};
        characterData.features.forEach(feature => {
            if (feature.usesResetOn === 'short-rest' && feature.maxUses !== null && feature.maxUses !== undefined) {
                usesReset[feature.name] = feature.maxUses;
            }
        });
        const newFeatureUsesMap = { ...featureUses, ...usesReset };
        const updatedFeaturesWithUses = characterData.features.map(f => ({ ...f, currentUses: newFeatureUsesMap[f.name] ?? f.currentUses }));
        setFeatureUses(newFeatureUsesMap);
        await updateCharacterData({ hitPoints: newHp, hitDice: newHitDice, features: updatedFeaturesWithUses });
        if (characterData?.campaignId && user) { await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName, actionType: 'statusChange', details: `${characterData.characterName} took a Short Rest.` }); }
    }, [characterData, featureUses, toast, user, userProfile, updateCharacterData]);

    const handleLongRest = useCallback(async () => {
        if (!characterData) return;
        const hitDiceToRegain = Math.max(1, Math.floor(characterData.hitDice.total / 2));
        const newCurrentHitDice = Math.min(characterData.hitDice.total, characterData.hitDice.remaining + hitDiceToRegain);
        const newHp: HitPointsState = { ...characterData.hitPoints, current: characterData.hitPoints.max, temporary: 0 };
        const newHitDice: HitDiceState = { ...characterData.hitDice, remaining: newCurrentHitDice };
        const usesReset: Record<string, number> = {};
        const slotsReset: Record<string, { max: number; remaining: number }> = {};
        characterData.features.forEach(feature => {
            if (feature.maxUses !== null && feature.maxUses !== undefined) usesReset[feature.name] = feature.maxUses;
        });
        if (characterData.spellcasting?.slots) {
            Object.entries(characterData.spellcasting.slots).forEach(([level, slotInfo]) => slotsReset[level] = { ...slotInfo, remaining: slotInfo.max });
        }
        const updatedFeaturesWithUses = characterData.features.map(f => ({ ...f, currentUses: usesReset[f.name] ?? f.currentUses }));
        const updatedSpellcasting = characterData.spellcasting ? { ...characterData.spellcasting, slots: slotsReset } : undefined;
        setFeatureUses(usesReset);
        setSpellSlotsRemaining(Object.fromEntries(Object.entries(slotsReset).map(([lvl, info]) => [lvl, info.remaining])));
        await updateCharacterData({ hitPoints: newHp, hitDice: newHitDice, features: updatedFeaturesWithUses, spellcasting: updatedSpellcasting });
        if (characterData?.campaignId && user) { await addGameLogEntry({ campaignId: characterData.campaignId, actorId: user.uid, actorName: userProfile?.displayName || characterData.playerName, actionType: 'statusChange', details: `${characterData.characterName} took a Long Rest.` }); }
    }, [characterData, toast, user, userProfile, updateCharacterData]);


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

    // Base character data needed for some displays (like original base stats)
    const baseCharacter = initialCharacter;

    return (
        <>
            <DDDiceRoller />
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
                                <CharacterStats stats={derivedStats} baseStats={baseCharacter.stats} modifiers={modifiers} />
                                <CharacterSkills character={characterData} proficiencyBonus={proficiencyBonus} onRoll={performRoll} />
                                <CharacterFeatures features={allFeaturesAndTraits} uses={featureUses} />
                            </div>
                        </TabsContent>

                        <TabsContent value="combat">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <CharacterCombatStats
                                    armorClass={armorClass}
                                    initiative={modifiers.dexterity}
                                    speed={`${characterData.race === 'Dwarf' ? 25 : 30} ft`} // Simplistic speed
                                    hitPoints={characterData.hitPoints}
                                    hitDice={characterData.hitDice}
                                    onHpChange={handleHitPointChange}
                                    isSaving={isSaving}
                                />
                                <div className="md:col-span-2">
                                    <CharacterActions
                                        weapons={equippedWeapons}
                                        features={actionableFeatures}
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
                                spellSlotsRemaining={spellSlotsRemaining}
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
                constitutionModifier={modifiers.constitution}
                maxHp={characterData.hitPoints.max}
                currentHp={characterData.hitPoints.current}
                onConfirm={handleShortRest}
                rollDiceFn={performRoll}
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
