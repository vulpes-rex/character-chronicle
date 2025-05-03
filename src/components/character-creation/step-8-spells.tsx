'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { Spell, CharacterClass, Feature } from '@/lib/types'; // Import Feature
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Wand2 } from 'lucide-react';
import { SPELL_SLOTS_BY_LEVEL } from '@/lib/types'; // Import spell slot table

interface Step8Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    availableSpells: Spell[];
    availableClasses: CharacterClass[];
    isLoadingSpells: boolean;
}

export function Step8Spells({
    data,
    updateData,
    setValidity,
    availableSpells,
    availableClasses,
    isLoadingSpells,
}: Step8Props) {
    // Initialize selectedSpells based on initialData or current data
    const initialSpells = useMemo(() => {
         const spells = data.spellsPrepared || data.spellsKnown || [];
         return [...new Set(spells)]; // Ensure unique spells
    }, [data.spellsPrepared, data.spellsKnown]);
    const [selectedSpells, setSelectedSpells] = useState<string[]>(initialSpells);

    // State to hold the calculated max spells and preparation type
    const [maxSelectableSpells, setMaxSelectableSpells] = useState<number>(0);
    const [preparationType, setPreparationType] = useState<'prepared' | 'known' | null>(null);

    // Filter available spells based on the character's primary class list
    const primaryCasterClassName = Object.keys(data.selectedClasses ?? {})[0];
    const primarySpellcastingClass = availableClasses.find(c => c.name === primaryCasterClassName);

    const classSpells = useMemo(() => {
        if (!primarySpellcastingClass || !availableSpells) return [];
        // Filter spells that are on the primary caster's class list AND are level 0 or 1 (for starting characters)
        // TODO: Adjust level filtering based on actual character level if editing
        const casterLevel = data.level || 1;
        const maxSpellLevel = Math.ceil(casterLevel / 2); // Simplified max level based on half-caster progression, needs refinement per class

        return availableSpells.filter(spell =>
            spell.classes.includes(primarySpellcastingClass.name) && spell.level <= maxSpellLevel
        );
    }, [primarySpellcastingClass, availableSpells, data.level]);

    // Group spells by level for display
    const spellsByLevel = useMemo(() => {
        const grouped: Record<number, Spell[]> = {};
        classSpells.forEach(spell => {
            if (!grouped[spell.level]) {
                grouped[spell.level] = [];
            }
            grouped[spell.level].push(spell);
        });
        // Sort spells within each level alphabetically
        Object.values(grouped).forEach(levelSpells => levelSpells.sort((a, b) => a.name.localeCompare(b.name)));
        return grouped;
    }, [classSpells]);

    // Handle spell selection changes
    const handleSpellSelection = (spellName: string, isSelected: boolean) => {
        setSelectedSpells(prev => {
            if (isSelected) {
                // Check limit only if not a Wizard adding to spellbook
                 if (preparationType !== null && primarySpellcastingClass?.name !== 'Wizard' && prev.length >= maxSelectableSpells) {
                     // Optionally show toast or alert about limit reached
                    return prev;
                }
                return [...new Set([...prev, spellName])]; // Add and ensure uniqueness
            } else {
                return prev.filter(name => name !== spellName);
            }
        });
    };

    // Effect to calculate preparation type, limits, and update parent state/validity
    useEffect(() => {
        const casterLevel = data.level || 1;
        let spellcastingAbilityMod = 0;
        if (primarySpellcastingClass?.spellcastingAbility && data.stats) {
            const abilityScore = data.stats[primarySpellcastingClass.spellcastingAbility] ?? 10;
            spellcastingAbilityMod = Math.floor((abilityScore - 10) / 2);
        }

        let calculatedPreparationType: 'prepared' | 'known' | null = null;
        let calculatedMaxSelectable = 0;

        if (primarySpellcastingClass?.spellcastingAbility) {
            // Determine preparation type based on SRD convention (expandable via class data)
             const knownCasters = ['Bard', 'Sorcerer', 'Warlock', 'Ranger']; // SRD known casters
             const preparedCasters = ['Cleric', 'Druid', 'Paladin', 'Wizard']; // SRD prepared casters

            if (preparedCasters.includes(primarySpellcastingClass.name)) {
                calculatedPreparationType = 'prepared';
                calculatedMaxSelectable = Math.max(1, spellcastingAbilityMod + casterLevel); // Standard prepared caster formula
            } else if (knownCasters.includes(primarySpellcastingClass.name)) {
                calculatedPreparationType = 'known';
                // TODO: Implement accurate known spells calculation per class (using a lookup table/service)
                 // Placeholder: This is often level + Cha mod for Bard/Sorc, specific numbers for Ranger/Warlock
                 calculatedMaxSelectable = casterLevel + 1; // Example placeholder
             } else {
                calculatedPreparationType = null; // Handle other cases if needed
            }
        }

        setMaxSelectableSpells(calculatedMaxSelectable);
        setPreparationType(calculatedPreparationType);

        // --- Validity and Update Logic ---
        const spellsFieldName = calculatedPreparationType === 'prepared' ? 'spellsPrepared' : 'spellsKnown';
        // Wizards don't have a limit on adding to spellbook, but preparation limit applies
        const limit = (primarySpellcastingClass?.name === 'Wizard' && calculatedPreparationType === 'prepared')
            ? calculatedMaxSelectable // Limit applies to prepared spells
            : (calculatedPreparationType === 'known' ? calculatedMaxSelectable : Infinity); // Known limit or infinite for wizard book


        // Validity check: Must select up to the allowed limit for known casters,
        // or up to the limit for prepared casters (excluding wizards adding to book).
        const isSelectionValid =
            calculatedPreparationType === null || // Not a spellcaster for this logic path
            (primarySpellcastingClass?.name === 'Wizard') || // Wizards just add to book, validity based on preparation later
            selectedSpells.length <= limit; // Check against appropriate limit


        setValidity(isSelectionValid);

        // Update parent state
        const updatePayload: Partial<PartialCharacterFormData> = {};
         if (calculatedPreparationType === 'prepared') {
            updatePayload.spellsPrepared = selectedSpells;
            updatePayload.spellsKnown = primarySpellcastingClass?.name === 'Wizard' ? selectedSpells : []; // Wizards know all spells in their book for preparation
         } else if (calculatedPreparationType === 'known') {
            updatePayload.spellsKnown = selectedSpells;
            updatePayload.spellsPrepared = []; // Known casters don't prepare in the same way
         } else {
            updatePayload.spellsKnown = [];
            updatePayload.spellsPrepared = [];
         }

        // Only update if the relevant spell list has changed
        const spellsChanged = JSON.stringify(updatePayload[spellsFieldName]) !== JSON.stringify(data[spellsFieldName]);
        if (spellsChanged) {
             console.log(`Step 8: Updating parent with ${spellsFieldName}:`, updatePayload);
            updateData(updatePayload);
        }

    }, [
        data.level,
        data.stats,
        primarySpellcastingClass,
        selectedSpells, // Depend on selected spells for validity and updates
        setValidity,
        updateData,
        data.spellsKnown, // Compare against parent state
        data.spellsPrepared // Compare against parent state
    ]);


    if (isLoadingSpells || !primarySpellcastingClass) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spell Selection</CardTitle>
                     <CardDescription>
                         {!primarySpellcastingClass
                            ? 'Select a spellcasting class in Step 3.'
                            : 'Loading spells...'
                         }
                     </CardDescription>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        );
    }

     const selectionLabel = preparationType === 'prepared' ? 'Prepare' : 'Know';
     const limitText = (preparationType === 'prepared' && primarySpellcastingClass.name !== 'Wizard')
        ? `Prepare up to ${maxSelectableSpells} spells from your class list.`
        : (preparationType === 'known')
            ? `Select up to ${maxSelectableSpells} spells known.`
            : (primarySpellcastingClass.name === 'Wizard')
                ? `Select spells to add to your spellbook.`
                : 'Spell selection type unknown.';

     const currentCount = selectedSpells.length;
     const countText = (primarySpellcastingClass.name !== 'Wizard' && preparationType !== null)
        ? `You have selected ${currentCount} / ${maxSelectableSpells}.`
        : '';

     const limit = (preparationType === 'prepared' && primarySpellcastingClass.name !== 'Wizard')
        ? maxSelectableSpells
        : (preparationType === 'known' ? maxSelectableSpells : Infinity);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spell Selection ({primarySpellcastingClass.name})</CardTitle>
                 <CardDescription>
                     {limitText} {countText}
                 </CardDescription>
                 {preparationType !== null && currentCount > limit && (
                      <Alert variant='destructive' className='p-2 text-xs mt-2'>
                          <AlertCircle className="h-3 w-3"/>
                          <AlertDescription>
                              You have selected more spells ({currentCount}) than allowed ({limit}).
                          </AlertDescription>
                      </Alert>
                  )}
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px] w-full pr-4">
                    <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(spellsByLevel).sort(([lvlA], [lvlB]) => parseInt(lvlA) - parseInt(lvlB)).map(([levelStr, spells]) => {
                            const level = parseInt(levelStr);
                            return (
                                <AccordionItem value={`level-${level}`} key={`level-${level}`} className="border rounded-md px-4 bg-secondary/30">
                                    <AccordionTrigger className='text-lg font-semibold hover:no-underline'>
                                        {level === 0 ? 'Cantrips' : `Level ${level}`}
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4 space-y-3">
                                        {spells.map(spell => {
                                            const isSelected = selectedSpells.includes(spell.name);
                                            // Wizards can add unlimited spells to book, others have limits
                                            const isDisabled = !isSelected && primarySpellcastingClass.name !== 'Wizard' && selectedSpells.length >= limit;
                                            return (
                                                <div key={spell.name} className='border-b pb-2 last:border-0 flex items-start gap-3'>
                                                    <Checkbox
                                                         id={`spell-${spell.name}`}
                                                         checked={isSelected}
                                                         onCheckedChange={(checked) => handleSpellSelection(spell.name, !!checked)}
                                                         disabled={isDisabled}
                                                         aria-label={`${selectionLabel} ${spell.name}`}
                                                         className='mt-1'
                                                     />
                                                    <div className='flex-grow'>
                                                        <Label htmlFor={`spell-${spell.name}`} className={`font-medium cursor-pointer ${isDisabled ? 'text-muted-foreground cursor-not-allowed' : ''}`}>
                                                            {spell.name} <span className='text-xs text-muted-foreground'>({spell.school})</span>
                                                         </Label>
                                                         <p className='text-xs text-muted-foreground'>Cast Time: {spell.castingTime}, Range: {spell.range}, Duration: {spell.duration}</p>
                                                         <p className='text-xs mt-1'>{spell.description}</p>
                                                         {spell.higherLevel && <p className='text-xs mt-1 text-blue-400'><em>At Higher Levels:</em> {spell.higherLevel}</p>}
                                                     </div>
                                                </div>
                                            );
                                        })}
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                        {Object.keys(spellsByLevel).length === 0 && (
                            <p className='text-sm italic text-muted-foreground text-center py-4'>
                                No spells available for {primarySpellcastingClass.name} at the current level.
                            </p>
                        )}
                    </Accordion>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
