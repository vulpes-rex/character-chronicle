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
import { getLevelUpOptions } from '@/services/dnd-api'; // Import getLevelUpOptions
import { useQuery } from '@tanstack/react-query';

interface Step8Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    availableSpells: Spell[];
    availableClasses: CharacterClass[];
    isLoadingSpells: boolean;
}

// Helper function to calculate spell slots (simplified, assumes single class)
// In a real app, this should handle multiclassing based on 5e rules
const calculateSpellSlots = (level: number, progression: string): Record<string, { max: number; remaining: number }> => {
    const slots: Record<string, { max: number; remaining: number }> = {};
    if (progression === 'none' || !progression) return slots;

    const progressionTable = SPELL_SLOTS_BY_LEVEL[progression];
    if (!progressionTable || level 1 || level  limit ? Infinity : maxSelectableSpells;
         const isValid = preparationType === null || selectedSpells.length  0) {
                                         updateData(updatePayload);
        }

    }, [selectedSpells, preparationType, setValidity, updateData, maxSelectableSpells, data.spellsKnown, data.spellsPrepared, primarySpellcastingClass?.name]);

    if (isLoadingSpells || !primarySpellcastingClass) {
        return (
            
                
                    
                        Spell Selection
                        
                            Select a spellcasting class in Step 3.
                             Loading spells...
                        
                    
                    
                
            
        );
    }

     const selectionLabel = preparationType === 'prepared' ? 'Prepare' : 'Select';
     const descriptionText = primarySpellcastingClass.name === 'Wizard'
        ? `Select spells to add to your spellbook.`
        : preparationType === 'prepared'
            ? `Prepare up to ${maxSelectableSpells} spells from your class list. You have selected ${selectedSpells.length} / ${maxSelectableSpells}.`
            : `Select ${maxSelectableSpells} spells known. You have selected ${selectedSpells.length} / ${maxSelectableSpells}.`;

    return (
        
            
                
                    Spell Selection ({primarySpellcastingClass.name})
                    
                        {descriptionText}
                         
                            You have selected more spells than allowed ({maxSelectableSpells}).
                         
                     
                
                
                     
                         
                             {Object.entries(spellsByLevel).map(([levelStr, spells]) => {
                                 const level = parseInt(levelStr);
                                 const limit = primarySpellcastingClass?.name === 'Wizard' ? Infinity : maxSelectableSpells;


                                 return (
                                    
                                        
                                            {level === 0 ? 'Cantrips' : `Level ${level}`}
                                        
                                        
                                             {spells.map(spell => {
                                                const isSelected = selectedSpells.includes(spell.name);
                                                const isDisabled = !isSelected && selectedSpells.length >= limit;
                                                 return (
                                                    
                                                         
                                                             {`${selectionLabel} ${spell.name}`}
                                                         
                                                         
                                                             {spell.name} ({spell.school})
                                                             {spell.description.split('.')[0]}.
                                                         
                                                     
                                                 );
                                             })}
                                        
                                    
                                 );
                             })}
                             {Object.keys(spellsByLevel).length === 0 && (
                                 
                                     No spells available for this class/level.
                                 
                             )}
                         
                     
                
            
        
    );
}
