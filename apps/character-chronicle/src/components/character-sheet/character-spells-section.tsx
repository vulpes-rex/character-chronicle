'use client';

import React, { useState, useMemo } from 'react';
import type { Character, Spell } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { WandSparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { castSpellAction } from '@/app/actions/character-actions'; // Use server action
import { useToast } from '@/hooks/use-toast';

interface CharacterSpellsSectionProps {
    characterId: string;
    playerId: string | null;
    spellcasting: Character['spellcasting'];
    spellsKnown: string[]; // Names/keys of known spells
    spellsPrepared?: string[]; // Optional: Names/keys of prepared spells
    allSpells: Spell[]; // All available spells for lookup
    onCharacterUpdate: (updatedCharacter: Character | null) => void; // Callback
}

export function CharacterSpellsSection({
    characterId,
    playerId,
    spellcasting,
    spellsKnown,
    spellsPrepared,
    allSpells,
    onCharacterUpdate,
}: CharacterSpellsSectionProps) {
    const { toast } = useToast();

     const handleCastSpell = async (spellName: string, spellLevel: number) => {
         if (!playerId) {
             toast({ variant: "destructive", title: "Error", description: "User not identified." });
             return;
         }
         try {
             const result = await castSpellAction(characterId, playerId, spellName, spellLevel);
             if (result.success && result.character) {
                 onCharacterUpdate(result.character); // Update parent state
                 toast({ title: "Spell Cast", description: `${spellName} (Level ${spellLevel}) cast.` });
             } else {
                 throw new Error(result.error || 'Failed to cast spell.');
             }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message });
         }
     };

    const spellList = useMemo(() => {
        // Filter allSpells to get details for known/prepared spells
        const knownSpellDetails = allSpells.filter(s => spellsKnown?.includes(s.name));
        // For prepared casters, further filter by spellsPrepared if provided
        const displaySpells = spellsPrepared
            ? knownSpellDetails.filter(s => spellsPrepared.includes(s.name))
            : knownSpellDetails;

        // Group spells by level
        return displaySpells.reduce((acc, spell) => {
            const level = spell.level;
            if (!acc[level]) {
                acc[level] = [];
            }
            acc[level].push(spell);
            // Sort spells alphabetically within each level
            acc[level].sort((a, b) => a.name.localeCompare(b.name));
            return acc;
        }, {} as Record<number, Spell[]>);
    }, [spellsKnown, spellsPrepared, allSpells]);

    if (!spellcasting) {
        return null; // Don't render section if character can't cast spells
    }

    const spellLevels = Object.keys(spellList).map(Number).sort((a, b) => a - b);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                     <span>Spellcasting ({spellcasting.ability?.substring(0, 3).toUpperCase()})</span>
                     <div className="text-sm font-normal space-x-2">
                        <span>DC: {spellcasting.spellSaveDC}</span>
                         <span>Attack: +{spellcasting.spellAttackBonus}</span>
                     </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-[400px] w-full pr-4">
                    <Accordion type="multiple" className="w-full">
                        {spellLevels.map((level) => {
                            const slots = spellcasting.slots?.[String(level)];
                            const levelName = level === 0 ? "Cantrips" : `Level ${level}`;

                            return (
                                <AccordionItem key={level} value={`level-${level}`}>
                                    <AccordionTrigger>
                                         <div className="flex justify-between items-center w-full pr-2">
                                             <span>{levelName}</span>
                                             {slots && level > 0 && (
                                                 <Badge variant="secondary">{slots.remaining}/{slots.max} Slots</Badge>
                                             )}
                                         </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-1">
                                        {spellList[level].length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No spells {spellsPrepared ? 'prepared' : 'known'} for this level.</p>
                                        ) : (
                                            spellList[level].map((spell) => (
                                                 <TooltipProvider key={spell.name}>
                                                     <Tooltip>
                                                         <div className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded">
                                                            <TooltipTrigger asChild>
                                                                 <span className="cursor-help">{spell.name}</span>
                                                             </TooltipTrigger>
                                                             {level > 0 && (
                                                                 <Button
                                                                     variant="ghost"
                                                                     size="sm"
                                                                     className="h-6 px-1 text-primary hover:text-primary/80"
                                                                     onClick={() => handleCastSpell(spell.name, level)}
                                                                     disabled={!slots || slots.remaining <= 0}
                                                                     title={`Cast ${spell.name}`}
                                                                 >
                                                                     <WandSparkles className="h-4 w-4"/>
                                                                 </Button>
                                                             )}
                                                         </div>
                                                          <TooltipContent side="top" align="start" className="max-w-xs">
                                                              <p className="font-semibold text-sm mb-1">{spell.name} <span className="text-muted-foreground text-xs">({spell.school})</span></p>
                                                              <p className="text-xs mb-1"><strong>Cast Time:</strong> {spell.castingTime}</p>
                                                              <p className="text-xs mb-1"><strong>Range:</strong> {spell.range}</p>
                                                              <p className="text-xs mb-1"><strong>Components:</strong> {spell.components.join(', ')}</p>
                                                              <p className="text-xs mb-1"><strong>Duration:</strong> {spell.duration}</p>
                                                              <p className="text-xs">{spell.description}</p>
                                                              {spell.higherLevel && <p className="text-xs mt-1 italic"><strong>At Higher Levels:</strong> {spell.higherLevel}</p>}
                                                          </TooltipContent>
                                                     </Tooltip>
                                                 </TooltipProvider>
                                             ))
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                 </ScrollArea>
            </CardContent>
        </Card>
    );
}
