
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dices } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import type { PartialCharacterFormData } from './character-creation-wizard';
import { rollDice } from '@/lib/types'; // Import rollDice
import type { CharacterRace } from '@/lib/types';

const statsSchema = z.object({
    strength: z.number().min(1).max(20), // Base scores, not including modifiers yet
    dexterity: z.number().min(1).max(20),
    constitution: z.number().min(1).max(20),
    intelligence: z.number().min(1).max(20),
    wisdom: z.number().min(1).max(20),
    charisma: z.number().min(1).max(20),
});

type Step4FormData = { stats: z.infer<typeof statsSchema> };

interface Step4Props {
    data: PartialCharacterFormData;
    updateData: (data: Pick<PartialCharacterFormData, 'stats'>) => void;
    setValidity: (isValid: boolean) => void;
    availableRaces: CharacterRace[]; // Pass available races
}

const ABILITIES: (keyof z.infer<typeof statsSchema>)[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

export function Step4AbilityScores({ data, updateData, setValidity, availableRaces }: Step4Props) {
    const { toast } = useToast();
    const [rolledScores, setRolledScores] = useState<number[]>([]);
    const [assignedScores, setAssignedScores] = useState<Partial<Record<keyof Step4FormData['stats'], number | null>>>(
        // Initialize with existing data or nulls
        ABILITIES.reduce((acc, ability) => {
            acc[ability] = data.stats?.[ability] ?? null;
            return acc;
        }, {} as Partial<Record<keyof Step4FormData['stats'], number | null>>)
    );
    const [useTashasRules, setUseTashasRules] = useState(false); // Tasha's Cauldron rule toggle
    const [tashasBonuses, setTashasBonuses] = useState<{ plusTwo: keyof Step4FormData['stats'] | null; plusOne: keyof Step4FormData['stats'] | null }>({ plusTwo: null, plusOne: null });

    const selectedRace = availableRaces.find(r => r.name === data.race);

    // Determine racial bonuses based on ruleset
    const racialBonuses = useMemo(() => {
        const bonuses: Partial<Record<keyof Step4FormData['stats'], number>> = {};
        if (!selectedRace) return bonuses;

        // Standard Racial Bonuses (Example for Human +1 All)
        if (!useTashasRules && selectedRace.name === 'Human') {
            ABILITIES.forEach(ability => bonuses[ability] = (bonuses[ability] || 0) + 1);
        }
        // TODO: Add standard bonuses for other races based on fetched data or hardcoded rules

        // Tasha's Rules: +2 to one, +1 to another OR +1 to three different ones (simplified to +2/+1 for now)
        if (useTashasRules) {
            if (tashasBonuses.plusTwo) bonuses[tashasBonuses.plusTwo] = (bonuses[tashasBonuses.plusTwo] || 0) + 2;
            if (tashasBonuses.plusOne) bonuses[tashasBonuses.plusOne] = (bonuses[tashasBonuses.plusOne] || 0) + 1;
        }

        return bonuses;
    }, [selectedRace, useTashasRules, tashasBonuses]);

    // Calculate final scores including racial bonuses
    const finalScores = useMemo(() => {
        const final: Partial<Record<keyof Step4FormData['stats'], number>> = {};
        ABILITIES.forEach(ability => {
            const base = assignedScores[ability] ?? 10; // Default to 10 if not assigned
            const bonus = racialBonuses[ability] ?? 0;
            final[ability] = base + bonus;
        });
        return final as Record<keyof Step4FormData['stats'], number>; // Assert non-partial
    }, [assignedScores, racialBonuses]);

    // Form specifically for validation of final scores (optional but good practice)
    const { formState: { isValid }, trigger } = useForm<Step4FormData>({
        resolver: zodResolver(z.object({ stats: statsSchema })), // Validate final scores
        mode: 'onChange',
        values: { stats: finalScores }, // Use calculated final scores for validation
    });

     // Validation logic: All scores must be assigned
     const allScoresAssigned = Object.values(assignedScores).every(score => score !== null);

    useEffect(() => {
        // Update parent state with the *final* calculated scores
        updateData({ stats: finalScores });
        // Validity depends on all scores being assigned and passing Zod validation
        setValidity(allScoresAssigned && isValid);
        trigger(); // Trigger validation when finalScores change
    }, [finalScores, updateData, setValidity, allScoresAssigned, isValid, trigger]);

    const rollStat = useCallback((): number => {
        const rolls = Array.from({ length: 4 }, () => rollDice('1d6'));
        rolls.sort((a, b) => a - b);
        rolls.shift();
        return rolls.reduce((sum, roll) => sum + roll, 0);
    }, []);

    const rollAllStats = useCallback(() => {
        const newScores = Array.from({ length: 6 }, rollStat).sort((a, b) => b - a); // Sort descending
        setRolledScores(newScores);
        // Reset assignments when re-rolling
        setAssignedScores(ABILITIES.reduce((acc, ability) => { acc[ability] = null; return acc; }, {}));
        toast({ title: "Stats Rolled!", description: "Assign the rolled scores to abilities." });
    }, [rollStat, toast]);

    const handleAssignScore = (ability: keyof Step4FormData['stats'], score: number | null) => {
        if (score === null) {
            // If unassigning, put the score back into rolledScores if it was there
            const currentScore = assignedScores[ability];
            if (currentScore !== null) {
                setRolledScores(prev => [...prev, currentScore].sort((a, b) => b - a));
            }
        } else {
            // Remove the assigned score from rolledScores
            setRolledScores(prev => {
                const index = prev.indexOf(score);
                if (index > -1) {
                    const nextScores = [...prev];
                    nextScores.splice(index, 1);
                    return nextScores;
                }
                return prev; // Should not happen if UI logic is correct
            });
        }

        // Update the assignment
        setAssignedScores(prev => ({
            ...prev,
            [ability]: score,
        }));
    };

    const handleTashasBonusChange = (type: 'plusTwo' | 'plusOne', ability: keyof Step4FormData['stats'] | null) => {
        setTashasBonuses(prev => {
            const otherType = type === 'plusTwo' ? 'plusOne' : 'plusTwo';
            // Prevent assigning the same ability to both +2 and +1
            if (ability && prev[otherType] === ability) {
                return { ...prev, [type]: ability, [otherType]: null };
            }
            return { ...prev, [type]: ability };
        });
    };

    const getModifier = (statValue: number | undefined): number => {
        return Math.floor(((statValue ?? 10) - 10) / 2);
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rolling and Assignment */}
            <div className="md:col-span-2 space-y-6">
                 <Card>
                     <CardHeader className="flex flex-row justify-between items-center">
                         <CardTitle>Roll Ability Scores</CardTitle>
                         <Button type="button" variant="outline" size="sm" onClick={rollAllStats}>
                             <Dices className="mr-2 h-4 w-4" /> Roll (4d6 Drop Lowest)
                         </Button>
                     </CardHeader>
                     <CardContent>
                         {rolledScores.length === 0 ? (
                             <p className="text-muted-foreground text-center">Roll stats to begin assignment.</p>
                         ) : (
                             <div className="flex flex-wrap gap-4 justify-center">
                                 {rolledScores.map((score, index) => (
                                     <Card key={index} className="p-4 text-center font-bold text-2xl bg-secondary">
                                         {score}
                                     </Card>
                                 ))}
                             </div>
                         )}
                     </CardContent>
                 </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Assign Scores</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {ABILITIES.map(ability => (
                             <div key={ability} className="space-y-1">
                                 <Label htmlFor={`assign-${ability}`} className="uppercase text-xs font-semibold">{ability}</Label>
                                 <Select
                                      value={assignedScores[ability]?.toString() ?? ""}
                                      onValueChange={(value) => handleAssignScore(ability, value ? parseInt(value) : null)}
                                      disabled={rolledScores.length === 0 && assignedScores[ability] === null} // Disable if no scores rolled and not already assigned
                                 >
                                      <SelectTrigger id={`assign-${ability}`}>
                                          <SelectValue placeholder="Assign..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                           {/* Option to unassign */}
                                           {assignedScores[ability] !== null && (
                                               <SelectItem value="">Unassign</SelectItem>
                                           )}
                                           {/* Show currently assigned score as an option */}
                                           {assignedScores[ability] !== null && (
                                                <SelectItem value={String(assignedScores[ability])} disabled>
                                                     {assignedScores[ability]} (Assigned)
                                                 </SelectItem>
                                           )}
                                           {/* Show available rolled scores */}
                                           {rolledScores.map((score, index) => (
                                               <SelectItem key={`${score}-${index}`} value={String(score)}>
                                                   {score}
                                               </SelectItem>
                                           ))}
                                       </SelectContent>
                                  </Select>
                             </div>
                         ))}
                     </CardContent>
                </Card>
            </div>

            {/* Racial Bonus & Final Scores */}
            <div className="md:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Racial Bonuses</CardTitle>
                         {selectedRace && (
                             <CardContent className="space-y-4 pt-4">
                                 <div className="flex items-center space-x-2">
                                     <Switch
                                         id="tashas-rules"
                                         checked={useTashasRules}
                                         onCheckedChange={setUseTashasRules}
                                     />
                                     <Label htmlFor="tashas-rules" className="text-sm">Use Tasha's Rules (+2/+1)</Label>
                                 </div>

                                 {useTashasRules ? (
                                     <div className='space-y-2'>
                                         <div>
                                             <Label htmlFor="tashas-plus-two" className="text-xs">Assign +2 Bonus</Label>
                                             <Select value={tashasBonuses.plusTwo ?? ""} onValueChange={(val) => handleTashasBonusChange('plusTwo', val as keyof Step4FormData['stats'] | null)}>
                                                 <SelectTrigger id="tashas-plus-two">
                                                     <SelectValue placeholder="Select Ability..." />
                                                 </SelectTrigger>
                                                 <SelectContent>
                                                      <SelectItem value="">None</SelectItem>
                                                     {ABILITIES.map(ab => <SelectItem key={`p2-${ab}`} value={ab}>{ab.charAt(0).toUpperCase() + ab.slice(1)}</SelectItem>)}
                                                 </SelectContent>
                                             </Select>
                                         </div>
                                         <div>
                                              <Label htmlFor="tashas-plus-one" className="text-xs">Assign +1 Bonus</Label>
                                              <Select value={tashasBonuses.plusOne ?? ""} onValueChange={(val) => handleTashasBonusChange('plusOne', val as keyof Step4FormData['stats'] | null)}>
                                                  <SelectTrigger id="tashas-plus-one">
                                                      <SelectValue placeholder="Select Ability..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                       <SelectItem value="">None</SelectItem>
                                                      {ABILITIES.map(ab => <SelectItem key={`p1-${ab}`} value={ab}>{ab.charAt(0).toUpperCase() + ab.slice(1)}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                     </div>
                                 ) : (
                                     <div className='text-xs text-muted-foreground space-y-1'>
                                         <p>Standard {selectedRace.name} Bonuses:</p>
                                         {Object.entries(racialBonuses).length > 0 ? (
                                              <ul className='list-disc pl-4'>
                                                 {Object.entries(racialBonuses).map(([ab, val]) => (
                                                    <li key={ab}>{ab.charAt(0).toUpperCase() + ab.slice(1)}: +{val}</li>
                                                 ))}
                                              </ul>
                                         ) : (
                                            <p><i>(None defined for this race)</i></p>
                                         )}
                                     </div>
                                 )}
                             </CardContent>
                         )}
                         {!selectedRace && (
                             <CardContent><p className="text-sm text-muted-foreground italic">Select a race in Step 2 to see bonuses.</p></CardContent>
                         )}
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Final Scores</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                         {ABILITIES.map((ability) => (
                            <div key={`final-${ability}`} className="text-center p-2 border rounded-md bg-secondary/30 relative pt-5">
                                <Label className="uppercase text-[0.65rem] font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{ability}</Label>
                                <div className="relative mt-0.5">
                                    <div className="text-3xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                       {finalScores[ability] ?? '-'}
                                    </div>
                                    <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-7 h-7 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">
                                        {getModifier(finalScores[ability]) >= 0 ? '+' : ''}{getModifier(finalScores[ability])}
                                    </div>
                                </div>
                                <div className='text-[0.6rem] text-muted-foreground h-3 mt-1'>
                                    ({assignedScores[ability] ?? '-'} Base + {racialBonuses[ability] ?? 0} Race)
                                </div>
                            </div>
                         ))}
                     </CardContent>
                     {!allScoresAssigned && <p className='text-center text-destructive text-xs pb-4'>Assign all rolled scores.</p>}
                 </Card>

            </div>
        </div>
    );
}
