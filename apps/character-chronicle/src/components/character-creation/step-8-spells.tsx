'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { Spell, CharacterClass } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { SPELL_SLOTS_BY_LEVEL } from '@/lib/types'; // Import spell slot table

interface Step8SpellsProps {
    data: PartialCharacterFormData;
    updateData: (newData: Partial<Pick<PartialCharacterFormData, 'spellsKnown' | 'spellsPrepared'>>) => void;
    setValidity: (isValid: boolean) => void;
    availableSpells: Spell[];
    availableClasses: CharacterClass[]; // Need class info for spell list and slots
    isLoadingSpells: boolean;
}

export function Step8Spells({ data, updateData, setValidity, availableSpells, availableClasses, isLoadingSpells }: Step8SpellsProps) {
    const { level, class: className, stats, features } = data;
    const [selectedSpells, setSelectedSpells] = useState<string[]>(data.spellsKnown || data.spellsPrepared || []);

    const spellcastingFeature = useMemo(() => features?.find(f => f.metadata?.effectType === 'spellcastingGrant'), [features]);
    const spellcastingAbility = spellcastingFeature?.metadata?.ability as keyof typeof stats | undefined;
    const spellcastingClass = availableClasses.find(c => c.name === className);
    const preparationType = spellcastingFeature?.metadata?.preparationType; // 'prepared' or 'known'
    const spellListSource = spellcastingFeature?.metadata?.spellListSource || className; // Class name by default

    // Determine max spells known/prepared (example logic, adjust per class)
    const maxKnownOrPrepared = useMemo(() => {
        if (!level || !spellcastingAbility || !stats || !spellcastingClass) return 0;
        const abilityMod = Math.floor(((stats[spellcastingAbility] ?? 10) - 10) / 2);

        switch (preparationType) {
            case 'known': // e.g., Sorcerer, Bard
                 // Look up known spells per level from class definition (needs to be added to CharacterClass type)
                return spellcastingClass?.spellsKnownByLevel?.[level] ?? 0;
            case 'prepared': // e.g., Cleric, Wizard, Druid
                return Math.max(1, abilityMod + level); // Common calculation
            default: // Warlock, Paladin, Ranger have specific rules
                return 0; // Needs specific class logic
        }
    }, [level, spellcastingAbility, stats, preparationType, spellcastingClass]);

    // Filter available spells based on the character's class list and max level they can cast
    const learnableSpells = useMemo(() => {
         if (!spellListSource || !level) return [];

         // Determine highest spell slot level
         const progression = spellcastingClass?.spellProgression || 'none';
         const progressionTable = SPELL_SLOTS_BY_LEVEL[progression];
         let highestSlotLevel = 0;
         if (progressionTable && level >= 1 && level <= progressionTable.length) {
             highestSlotLevel = progressionTable[level - 1].findIndex(slots => slots === 0);
             if (highestSlotLevel === -1) highestSlotLevel = 9; // Can cast level 9
         }

         return availableSpells.filter(spell =>
            spell.classes.includes(spellListSource) && spell.level <= highestSlotLevel
         );
    }, [availableSpells, spellListSource, level, spellcastingClass]);

     // Group spells by level for display
     const spellsByLevel = useMemo(() => {
         return learnableSpells.reduce((acc, spell) => {
             const lvl = spell.level;
             if (!acc[lvl]) acc[lvl] = [];
             acc[lvl].push(spell);
             acc[lvl].sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
             return acc;
         }, {} as Record<number, Spell[]>);
     }, [learnableSpells]);


    const handleSpellSelection = (spellName: string, isSelected: boolean) => {
        setSelectedSpells(prev => {
            const newSelection = isSelected
                ? [...prev, spellName]
                : prev.filter(name => name !== spellName);

             // Enforce limit for known/prepared casters if applicable
             if ((preparationType === 'known' || preparationType === 'prepared') && newSelection.length > maxKnownOrPrepared) {
                 alert(`You can only select up to ${maxKnownOrPrepared} spells.`); // Basic feedback
                 return prev; // Revert if limit exceeded
             }

            return newSelection;
        });
    };

    // Update parent data and validity
    useEffect(() => {
        const updatePayload: Partial<Pick<PartialCharacterFormData, 'spellsKnown' | 'spellsPrepared'>> = {};
        if (preparationType === 'prepared') {
            updatePayload.spellsPrepared = selectedSpells;
            updatePayload.spellsKnown = learnableSpells.map(s => s.name); // Assume prepared casters "know" all spells on their list up to their level
        } else { // 'known' or other types
            updatePayload.spellsKnown = selectedSpells;
        }
         updateData(updatePayload);

         // Basic Validity: Ensure the correct number of spells are selected if limited
         let isValid = true;
         if (preparationType === 'known' || preparationType === 'prepared') {
             isValid = selectedSpells.length <= maxKnownOrPrepared; // Could add a minimum requirement if needed
         }
         setValidity(isValid);

    }, [selectedSpells, preparationType, maxKnownOrPrepared, updateData, setValidity, learnableSpells]);

    if (isLoadingSpells) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (!spellcastingFeature) {
        // This step should ideally be skipped by the wizard logic if no spellcasting is granted.
        return (
             <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                 <AlertTitle>No Spellcasting</AlertTitle>
                 <AlertDescription>This character does not have spellcasting features.</AlertDescription>
             </Alert>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Select Spells</CardTitle>
                <CardDescription>
                    {preparationType === 'prepared' ? `Prepare up to ${maxKnownOrPrepared} spells from your class list.` :
                     preparationType === 'known' ? `Select ${maxKnownOrPrepared} spells known for your level.` :
                     'Review spells granted by your class.'}
                    {` You have selected ${selectedSpells.length}.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {learnableSpells.length === 0 ? (
                     <p className="text-muted-foreground text-center py-4">No spells available for your class and level in the current content packs.</p>
                 ) : (
                     <ScrollArea className="h-[500px] w-full pr-4">
                         <Accordion type="multiple" className="w-full" defaultValue={Object.keys(spellsByLevel).map(l => `level-${l}`)}>
                             {Object.entries(spellsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, spells]) => (
                                <AccordionItem key={level} value={`level-${level}`}>
                                    <AccordionTrigger>
                                        Level {level} {level === '0' ? ' (Cantrips)' : ''}
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        {spells.map(spell => (
                                            <div key={spell.name} className="flex items-center space-x-3 py-1">
                                                <Checkbox
                                                    id={`spell-${spell.name}`}
                                                    checked={selectedSpells.includes(spell.name)}
                                                    onCheckedChange={(checked) => handleSpellSelection(spell.name, Boolean(checked))}
                                                    disabled={
                                                        (preparationType === 'known' || preparationType === 'prepared') &&
                                                        !selectedSpells.includes(spell.name) &&
                                                        selectedSpells.length >= maxKnownOrPrepared
                                                    }
                                                />
                                                <Label htmlFor={`spell-${spell.name}`} className="flex flex-col flex-grow cursor-pointer">
                                                    <span className="font-medium">{spell.name} <Badge variant="outline" className="text-xs">{spell.school}</Badge></span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{spell.description}</span>
                                                </Label>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
