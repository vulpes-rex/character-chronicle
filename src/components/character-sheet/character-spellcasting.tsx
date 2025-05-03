import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2 } from 'lucide-react';
import type { Character, Spell } from '@/lib/types';

interface CharacterSpellcastingProps {
    spellcasting: Character['spellcasting'];
    spellSaveDC: number;
    spellAttackBonus: number;
    spellsByLevel: Record<number, Spell[]>; // Spells grouped by level
    spellSlotsRemaining: Record<string, number>; // Remaining slots by level string key
    onCastSpell: (spellName: string, level: number) => void;
    isSaving: boolean;
    isLoadingSpells: boolean;
}

export function CharacterSpellcasting({
    spellcasting,
    spellSaveDC,
    spellAttackBonus,
    spellsByLevel,
    spellSlotsRemaining,
    onCastSpell,
    isSaving,
    isLoadingSpells,
}: CharacterSpellcastingProps) {
    if (!spellcasting) {
        return (
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Spellcasting</CardTitle>
                    <CardDescription>This character does not have spellcasting abilities.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">No spellcasting features found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Spellcasting</CardTitle>
                <CardDescription className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                    <span>Ability: <Badge variant="secondary">{spellcasting.ability?.toUpperCase()}</Badge></span>
                    <span>Save DC: <Badge variant="secondary">{spellSaveDC}</Badge></span>
                    <span>Attack Bonus: <Badge variant="secondary">+{spellAttackBonus}</Badge></span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingSpells ? (
                    <Skeleton className="h-64 w-full" />
                ) : (
                    <ScrollArea className="h-[500px] w-full pr-4">
                        <Accordion type="multiple" className="w-full space-y-2">
                            {/* Cantrips */}
                            {spellsByLevel[0] && spellsByLevel[0].length > 0 && (
                                <AccordionItem value="level-0" className="border rounded-md px-4 bg-secondary/30">
                                    <AccordionTrigger className='text-lg font-semibold hover:no-underline'>Cantrips</AccordionTrigger>
                                    <AccordionContent className="pt-2 pb-4 space-y-3">
                                        {spellsByLevel[0].map(spell => (
                                            <div key={spell.name} className='border-b pb-2 last:border-0'>
                                                <p className='font-medium'>{spell.name} <span className='text-xs text-muted-foreground'>({spell.school})</span></p>
                                                <p className='text-xs text-muted-foreground'>Cast Time: {spell.castingTime}, Range: {spell.range}, Duration: {spell.duration}</p>
                                                <p className='text-xs mt-1'>{spell.description}</p>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            )}
                            {/* Leveled Spells */}
                            {Object.entries(spellcasting.slots).sort(([lvlA], [lvlB]) => parseInt(lvlA) - parseInt(lvlB)).map(([levelStr, slotInfo]) => {
                                const spellLevel = parseInt(levelStr);
                                const spellsForLevel = spellsByLevel[spellLevel] || [];
                                if (slotInfo.max === 0) return null;
                                const currentSlots = spellSlotsRemaining[levelStr] ?? slotInfo.remaining;

                                return (
                                    <AccordionItem value={`level-${levelStr}`} key={`level-${levelStr}`} className="border rounded-md px-4 bg-secondary/30">
                                        <AccordionTrigger className='text-lg font-semibold hover:no-underline'>
                                            Level {levelStr} Spells ({currentSlots} / {slotInfo.max} Slots)
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-4 space-y-3">
                                            {spellsForLevel.length === 0 ? (
                                                <p className='text-sm italic text-muted-foreground'>No level {levelStr} spells known/prepared.</p>
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
                                                            onClick={() => onCastSpell(spell.name, spell.level)}
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
                             {Object.keys(spellsByLevel).length === 0 && (
                                 <p className='text-sm italic text-muted-foreground text-center py-4'>
                                     No spells known or prepared.
                                 </p>
                             )}
                        </Accordion>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
