'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Label } from '@/components/ui/label'; // Use alias
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Use alias
import { AlertCircle, Dices, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { rollDice } from '@/lib/types'; // Import dice roller

// Ability Scores type (should match Character['stats'])
type AbilityScores = Record<keyof PartialCharacterFormData['stats'], number | null>;
type AbilityScoreName = keyof AbilityScores;

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES: AbilityScoreName[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

interface Step4AbilityScoresProps {
    data: PartialCharacterFormData;
    updateData: (newData: PartialCharacterFormData) => void;
    setValidity: (isValid: boolean) => void;
}

export function Step4AbilityScores({ data, updateData, setValidity }: Step4AbilityScoresProps) {
    const [method, setMethod] = useState<'roll' | 'standardArray' | 'manual'>('roll');
    const [rolledScores, setRolledScores] = useState<number[]>([]);
    const [assignedScores, setAssignedScores] = useState<AbilityScores>(
        // Initialize with existing data or empty nulls
         ABILITIES.reduce((acc, ability) => {
             acc[ability] = data.stats?.[ability] ?? null;
             return acc;
         }, {} as AbilityScores)
    );
    const [manualScores, setManualScores] = useState<AbilityScores>(
         ABILITIES.reduce((acc, ability) => {
            acc[ability] = data.stats?.[ability] ?? 10; // Default to 10 for manual if no data
            return acc;
        }, {} as AbilityScores)
    );
    const [racialBonuses, setRacialBonuses] = useState<Partial<Record<AbilityScoreName, number>>>({}); // e.g., { strength: 2, constitution: 1 }
    const [tashasRule, setTashasRule] = useState<boolean>(false); // TODO: Add UI toggle for this
    const [tashasAssignedBonuses, setTashasAssignedBonuses] = useState<Partial<Record<AbilityScoreName, number>>>({}); // e.g., { strength: 1, charisma: 1 }

    const { toast } = useToast();

    // TODO: Fetch racial bonus details based on selected race (data.race)
    // This should ideally come from a feature service or dnd-api service call
    useEffect(() => {
        // Placeholder: Replace with actual fetching logic
        const fetchRacialBonuses = async () => {
            if (data.race === "Human") {
                setRacialBonuses({ strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 });
            } else if (data.race === "Elf") {
                setRacialBonuses({ dexterity: 2 }); // Example, depends on subrace feature
            } else if (data.race === "Dwarf") {
                 setRacialBonuses({ constitution: 2 }); // Example
            } else if (data.race === "Halfling") {
                 setRacialBonuses({ dexterity: 2 }); // Example
             } else {
                setRacialBonuses({});
            }
            // Reset Tasha's assignment if race changes
             setTashasAssignedBonuses({});
        };
        fetchRacialBonuses();
    }, [data.race]);

    // Calculate total bonuses for Tasha's rule
     const totalRacialBonusPoints = useMemo(() => Object.values(racialBonuses).reduce((sum, val) => sum + (val || 0), 0), [racialBonuses]);
     const assignedTashasPoints = useMemo(() => Object.values(tashasAssignedBonuses).reduce((sum, val) => sum + (val || 0), 0), [tashasAssignedBonuses]);


     // Calculate final scores based on method and bonuses
     const finalScores = useMemo(() => {
         const base: AbilityScores = method === 'manual' ? manualScores : assignedScores;
         const bonusesToApply = tashasRule ? tashasAssignedBonuses : racialBonuses;

         return ABILITIES.reduce((acc, ability) => {
             acc[ability] = (base[ability] || 0) + (bonusesToApply[ability] || 0);
             return acc;
         }, {} as Record<AbilityScoreName, number>); // Ensure number type for final

     }, [method, manualScores, assignedScores, racialBonuses, tashasRule, tashasAssignedBonuses]);


    // Roll 4d6 drop lowest
    const rollStat = (): number => {
        const rolls = Array.from({ length: 4 }, () => rollDice('1d6'));
        rolls.sort((a, b) => a - b); // Sort ascending
        return rolls.slice(1).reduce((sum, val) => sum + val, 0); // Sum highest 3
    };

    const handleRollAll = () => {
        setRolledScores(Array.from({ length: 6 }, rollStat));
        // Reset assignments when re-rolling
        setAssignedScores(ABILITIES.reduce((acc, ab) => ({ ...acc, [ab]: null }), {}));
    };

    // Handle assigning a rolled score or standard array value to an ability
    const handleAssignScore = (ability: AbilityScoreName, valueStr: string | null) => {
         const value = valueStr ? parseInt(valueStr) : null;
         const currentAssignment = assignedScores[ability];

         setAssignedScores(prev => {
            const newAssignments = { ...prev, [ability]: value };

            // Ensure no score is assigned multiple times
            if (value !== null) {
                ABILITIES.forEach(ab => {
                     if (ab !== ability && newAssignments[ab] === value) {
                         // If the new value was already assigned elsewhere, clear the old assignment
                        newAssignments[ab] = null;
                     }
                 });
            }

            return newAssignments;
         });
     };

    // Handle manual score input change
    const handleManualChange = (ability: AbilityScoreName, value: string) => {
        const score = parseInt(value);
        setManualScores(prev => ({
            ...prev,
            [ability]: isNaN(score) ? null : Math.max(1, Math.min(20, score)), // Clamp 1-20
        }));
    };

    // Handle Tasha's bonus assignment
    const handleTashaBonusChange = (ability: AbilityScoreName, bonusChange: number) => {
         setTashasAssignedBonuses(prev => {
             const currentBonus = prev[ability] || 0;
             const newBonus = currentBonus + bonusChange;
             const totalAssignedAfterChange = assignedTashasPoints - currentBonus + newBonus;

              // Prevent assigning more points than available or negative bonuses
              if (newBonus < 0 || totalAssignedAfterChange > totalRacialBonusPoints) {
                  return prev; // Invalid change, keep previous state
              }

             return { ...prev, [ability]: newBonus };
         });
     };

    // Update main data and validity when final scores change
    useEffect(() => {
        updateData({ stats: finalScores });

        // Validation Logic
        let isValid = false;
        if (method === 'manual') {
            isValid = ABILITIES.every(ab => typeof finalScores[ab] === 'number'); // All manual scores must be numbers
        } else {
            isValid = ABILITIES.every(ab => typeof assignedScores[ab] === 'number'); // All scores must be assigned
        }
         // Check Tasha's rule assignment if active
         if (tashasRule && assignedTashasPoints !== totalRacialBonusPoints) {
             isValid = false;
         }

        setValidity(isValid);
    }, [finalScores, method, assignedScores, tashasRule, assignedTashasPoints, totalRacialBonusPoints, updateData, setValidity]);


    const unassignedScores = useMemo(() => {
        const sourceArray = method === 'roll' ? rolledScores : STANDARD_ARRAY;
        const currentlyAssigned = Object.values(assignedScores).filter(v => v !== null);
        return sourceArray.filter(score => !currentlyAssigned.includes(score));
    }, [method, rolledScores, assignedScores]);


    return (
        <div className="space-y-6">
            {/* Method Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Ability Score Generation Method</CardTitle>
                    <CardDescription>Choose how to determine your character's ability scores.</CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={method} onValueChange={(value) => setMethod(value as any)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Label htmlFor="roll" className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground", method === 'roll' && "border-primary")}>
                            <RadioGroupItem value="roll" id="roll" className="sr-only" />
                            <Dices className="mb-3 h-6 w-6" /> Roll (4d6 drop lowest)
                        </Label>
                        <Label htmlFor="standardArray" className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground", method === 'standardArray' && "border-primary")}>
                            <RadioGroupItem value="standardArray" id="standardArray" className="sr-only" />
                            <span className="mb-3 text-xl font-bold">[15, 14, 13, 12, 10, 8]</span> Standard Array
                        </Label>
                        <Label htmlFor="manual" className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground", method === 'manual' && "border-primary")}>
                             <RadioGroupItem value="manual" id="manual" className="sr-only" />
                            <span className="mb-3 text-xl font-bold">✎</span> Manual Entry / Point Buy
                        </Label>
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Score Assignment / Input */}
            <Card>
                 <CardHeader>
                     <CardTitle>
                         {method === 'roll' && "Assign Rolled Scores"}
                         {method === 'standardArray' && "Assign Standard Array"}
                         {method === 'manual' && "Enter Scores Manually"}
                     </CardTitle>
                     {method === 'roll' && (
                         <CardDescription>Roll stats and assign them to abilities.</CardDescription>
                     )}
                 </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Roll Section */}
                     {method === 'roll' && (
                         <div className="space-y-4">
                             <Button onClick={handleRollAll}><Dices className="mr-2 h-4 w-4" /> Roll Stats</Button>
                             <div className="flex flex-wrap gap-2">
                                 {rolledScores.length > 0 ? rolledScores.map((score, index) => (
                                     <span key={index} className="text-lg font-semibold p-2 border rounded bg-secondary">{score}</span>
                                 )) : <p className="text-sm text-muted-foreground">Click "Roll Stats" to generate scores.</p>}
                             </div>
                              {rolledScores.length > 0 && (
                                   <p className="text-xs text-muted-foreground">Unassigned scores: {unassignedScores.join(', ')}</p>
                              )}
                         </div>
                     )}

                     {/* Standard Array Display */}
                     {method === 'standardArray' && (
                         <div className="space-y-2">
                             <Label>Standard Array Scores:</Label>
                             <div className="flex flex-wrap gap-2">
                                 {STANDARD_ARRAY.map((score, index) => (
                                     <span key={index} className="text-lg font-semibold p-2 border rounded bg-secondary">{score}</span>
                                 ))}
                             </div>
                             <p className="text-xs text-muted-foreground">Unassigned scores: {unassignedScores.join(', ')}</p>
                         </div>
                     )}

                     {/* Assignment / Manual Input */}
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                         {ABILITIES.map(ability => (
                             method === 'manual' ? (
                                 <div key={ability} className="space-y-1">
                                     <Label htmlFor={`manual-${ability}`} className="uppercase text-xs font-semibold">{ability}</Label>
                                     <Input
                                         id={`manual-${ability}`}
                                         type="number"
                                         min="1"
                                         max="20" // Adjust max if needed for your rules
                                         value={manualScores[ability] ?? ''}
                                         onChange={(e) => handleManualChange(ability, e.target.value)}
                                         className="h-9 text-center"
                                     />
                                 </div>
                             ) : (
                                 <div key={ability} className="space-y-1"> {/* Use stable key */}
                                     <Label htmlFor={`assign-${ability}`} className="uppercase text-xs font-semibold">{ability}</Label>
                                     <Select
                                         value={assignedScores[ability]?.toString() ?? ""}
                                         onValueChange={(value) => handleAssignScore(ability, value ? value : null)} // Allow unassigning
                                         disabled={(method === 'roll' && rolledScores.length === 0)} // Disable if no scores rolled
                                     >
                                         <SelectTrigger id={`assign-${ability}`} className="h-9">
                                              <SelectValue placeholder="-" />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="">- Unassign -</SelectItem> {/* Explicit unassign option */}
                                             {(method === 'roll' ? rolledScores : STANDARD_ARRAY).map((score, index) => {
                                                  const scoreStr = score.toString();
                                                  const isAssignedElsewhere = ABILITIES.some(ab => ab !== ability && assignedScores[ab] === score);
                                                  return (
                                                       <SelectItem
                                                          key={`${score}-${index}`} // Key needs to be unique even if scores repeat
                                                          value={scoreStr}
                                                          disabled={isAssignedElsewhere && assignedScores[ability] !== score} // Disable if assigned elsewhere, unless it's the current assignment
                                                       >
                                                          {score}
                                                       </SelectItem>
                                                  );
                                             })}
                                         </SelectContent>
                                     </Select>
                                 </div>
                             )
                         ))}
                     </div>
                 </CardContent>
             </Card>


            {/* Racial Bonus Application */}
            <Card>
                 <CardHeader>
                    <CardTitle>Racial Bonuses</CardTitle>
                    {/* TODO: Add Tasha's Rule Toggle */}
                 </CardHeader>
                 <CardContent>
                     {tashasRule ? (
                          <div className="space-y-2">
                             <p className="text-sm text-muted-foreground">Assign {totalRacialBonusPoints} points based on {data.race || 'your race'} (Tasha's Rule).</p>
                             <p className="text-sm font-semibold">Points Assigned: {assignedTashasPoints} / {totalRacialBonusPoints}</p>
                             {assignedTashasPoints !== totalRacialBonusPoints && (
                                 <p className="text-xs text-destructive">Please assign all racial bonus points.</p>
                             )}
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                                 {ABILITIES.map(ability => (
                                     <div key={`tasha-${ability}`} className="flex items-center justify-between border rounded p-2">
                                         <Label className="uppercase text-xs font-semibold">{ability}</Label>
                                         <div className="flex items-center gap-1">
                                            <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleTashaBonusChange(ability, -1)} disabled={(tashasAssignedBonuses[ability] || 0) <= 0}>-</Button>
                                            <span className="w-6 text-center font-medium">{tashasAssignedBonuses[ability] || 0}</span>
                                            <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleTashaBonusChange(ability, 1)} disabled={assignedTashasPoints >= totalRacialBonusPoints}>+</Button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                          </div>
                     ) : (
                          <div className="space-y-1">
                             <p className="text-sm text-muted-foreground">Standard bonuses for {data.race || 'selected race'}:</p>
                              <div className="flex flex-wrap gap-2">
                                 {Object.entries(racialBonuses).length > 0 ? Object.entries(racialBonuses).map(([stat, bonus]) => (
                                     <span key={stat} className="text-sm border rounded px-2 py-1 bg-secondary">
                                         +{bonus} {stat.charAt(0).toUpperCase() + stat.slice(1)}
                                     </span>
                                  )) : <span className="text-sm italic">None</span>}
                              </div>
                          </div>
                     )}
                 </CardContent>
            </Card>

             {/* Final Scores Display */}
             <Card>
                 <CardHeader>
                     <CardTitle>Final Scores (with Racial Bonuses)</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-3 md:grid-cols-6 gap-4">
                     {ABILITIES.map(ability => {
                         const score = finalScores[ability];
                         const modifier = score !== null ? Math.floor((score - 10) / 2) : 0;
                         return (
                             <div key={`final-${ability}`} className="text-center border rounded p-3 bg-card shadow-sm">
                                 <Label className="text-xs font-semibold uppercase text-muted-foreground">{ability.substring(0, 3)}</Label>
                                 <p className="text-2xl font-bold">{score ?? '-'}</p>
                                 <p className={cn("font-medium text-lg", modifier >= 0 ? "text-green-600" : "text-red-600")}>{modifier >= 0 ? `+${modifier}` : modifier}</p>
                             </div>
                         );
                     })}
                 </CardContent>
             </Card>

        </div>
    );
}
