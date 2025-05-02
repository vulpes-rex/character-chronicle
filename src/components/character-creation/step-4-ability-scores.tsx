
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select components
import { useToast } from '@/hooks/use-toast';
import { Dices } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import type { PartialCharacterFormData } from './character-creation-wizard';
import { rollDice } from '@/lib/types'; // Import rollDice
import type { CharacterRace } from '@/lib/types';

const statsSchema = z.object({
    strength: z.number().min(1).max(20), // Represents FINAL scores (base + racial)
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
    editMode?: boolean; // Added editMode prop
}

const ABILITIES: (keyof z.infer<typeof statsSchema>)[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const UNASSIGN_VALUE = "__UNASSIGN__"; // Constant for unassign value

// Helper to calculate standard racial bonuses (adjust as needed for more races)
const getStandardRacialBonuses = (raceName?: string): Partial<Record<keyof Step4FormData['stats'], number>> => {
    const bonuses: Partial<Record<keyof Step4FormData['stats'], number>> = {};
    if (!raceName) return bonuses;
    // Add standard bonuses for races here
    if (raceName === 'Human') {
        ABILITIES.forEach(ability => bonuses[ability] = (bonuses[ability] || 0) + 1);
    } else if (raceName === 'Dwarf') {
         bonuses.constitution = (bonuses.constitution || 0) + 2;
         // Add subrace bonuses if needed
    } else if (raceName === 'Elf') {
        bonuses.dexterity = (bonuses.dexterity || 0) + 2;
        // Add subrace bonuses if needed
    } else if (raceName === 'Halfling') {
        bonuses.dexterity = (bonuses.dexterity || 0) + 2;
         // Add subrace bonuses if needed
    }
    // Add more races...
    return bonuses;
};


export function Step4AbilityScores({ data, updateData, setValidity, availableRaces, editMode = false }: Step4Props) {
    const { toast } = useToast();
    const [rolledScores, setRolledScores] = useState<number[]>([]);
    // assignedScores now ONLY holds the BASE scores (rolled or point-buy, pre-racial)
    const [assignedScores, setAssignedScores] = useState<Partial<Record<keyof Step4FormData['stats'], number | null>>>(
         // Initialize based on data.stats ONLY if not in edit mode, otherwise wait for effect
        !editMode && data.stats
            ? ABILITIES.reduce((acc, ability) => {
                  acc[ability] = data.stats![ability]; // Assume data.stats is populated if passed
                  return acc;
              }, {} as Partial<Record<keyof Step4FormData['stats'], number | null>>)
            : ABILITIES.reduce((acc, ability) => {
                  acc[ability] = null; // Initialize as null
                  return acc;
              }, {} as Partial<Record<keyof Step4FormData['stats'], number | null>>)
    );

    const [useTashasRules, setUseTashasRules] = useState(false); // Tasha's Cauldron rule toggle
    const [tashasBonuses, setTashasBonuses] = useState<{ plusTwo: keyof Step4FormData['stats'] | null; plusOne: keyof Step4FormData['stats'] | null }>({ plusTwo: null, plusOne: null });

    const selectedRace = availableRaces.find(r => r.name === data.race);

    // Use react-hook-form for Zod validation, but don't drive state from it directly
     const { formState: { isValid: formIsValid }, trigger, watch, reset } = useForm<Step4FormData>({
        resolver: zodResolver(z.object({ stats: statsSchema })), // Validate final scores schema
        mode: 'onChange',
         // Default values will be set by the main useEffect below
    });

     // --- Initialization Effect for Edit Mode ---
     useEffect(() => {
         if (editMode && data.stats) {
            // Derive base scores from the initialData (which includes racial bonuses)
            // Assume standard bonuses were used during initial creation for simplicity
            const initialFinalStats = data.stats;
            const standardBonuses = getStandardRacialBonuses(data.race);
            const derivedBaseScores: Partial<Record<keyof Step4FormData['stats'], number | null>> = {};

            ABILITIES.forEach(ability => {
                const finalScore = initialFinalStats[ability];
                const bonus = standardBonuses[ability] || 0;
                // Ensure score is a number before subtracting
                if (typeof finalScore === 'number') {
                   derivedBaseScores[ability] = finalScore - bonus;
                } else {
                   derivedBaseScores[ability] = 10; // Default if initial data is weird
                }
            });
            setAssignedScores(derivedBaseScores);
            // Disable Tasha's rules in edit mode to avoid complexity of reversing its choice
            setUseTashasRules(false);
         }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [editMode, data.stats, data.race]); // Run only when edit mode or initial data changes


    // Determine racial bonuses based on ruleset (only applied for calculation, not stored in assignedScores)
    const racialBonuses = useMemo(() => {
        const bonuses: Partial<Record<keyof Step4FormData['stats'], number>> = {};
        if (!selectedRace) return bonuses;

        // Tasha's Rules: +2 to one, +1 to another OR +1 to three different ones (simplified to +2/+1 for now)
        if (useTashasRules && !editMode) { // Apply Tasha's only in create mode
            if (tashasBonuses.plusTwo) bonuses[tashasBonuses.plusTwo] = (bonuses[tashasBonuses.plusTwo] || 0) + 2;
            if (tashasBonuses.plusOne) bonuses[tashasBonuses.plusOne] = (bonuses[tashasBonuses.plusOne] || 0) + 1;
        } else {
            // Apply Standard Racial Bonuses if not using Tasha's or in edit mode
            Object.assign(bonuses, getStandardRacialBonuses(selectedRace.name));
        }

        return bonuses;
    }, [selectedRace, useTashasRules, tashasBonuses, editMode]);


     // Validation logic: All base scores must be assigned
     const allScoresAssigned = useMemo(() => Object.values(assignedScores).every(score => typeof score === 'number' && score >= 1), [assignedScores]);


     // Main Effect: Calculate final scores and update parent wizard state
    useEffect(() => {
        // Calculate final scores (base + racial)
        const finalScores: Partial<Record<keyof Step4FormData['stats'], number>> = {};
        let calculationValid = true;
        ABILITIES.forEach(ability => {
            const base = assignedScores[ability];
            const bonus = racialBonuses[ability] || 0;
            if (base === null || base === undefined) {
                calculationValid = false; // Cannot calculate if base is missing
                finalScores[ability] = 10; // Default for display/validation purposes
            } else {
               finalScores[ability] = base + bonus;
            }
        });
        const finalScoresComplete = finalScores as Record<keyof Step4FormData['stats'], number>; // Assert non-partial

        // Reset form values for validation check against the calculated final scores
        reset({ stats: finalScoresComplete });

        // Update parent only if calculated scores differ from parent's state AND all base scores are assigned
        if (allScoresAssigned && JSON.stringify(finalScoresComplete) !== JSON.stringify(data.stats)) {
            console.log("Step 4: Updating parent data with final scores:", finalScoresComplete);
            updateData({ stats: finalScoresComplete });
        }

        // Set validity based on assignment and Zod validation of the *final* scores
        setValidity(allScoresAssigned && formIsValid);
        // Trigger validation explicitly if base scores change
         // Use a separate effect to trigger validation to avoid potential loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        assignedScores, // Depends on base scores
        racialBonuses,  // Depends on calculated racial bonuses
        updateData,
        setValidity,
        reset,
        // trigger, // Moved to separate effect
        allScoresAssigned,
        // formIsValid, // Moved to separate effect
        data.stats // Compare against parent's current state
    ]);

    // Separate effect to trigger validation after assignment changes
    useEffect(() => {
      if (allScoresAssigned) {
        trigger();
      }
    }, [allScoresAssigned, trigger]);

     // Separate effect to update parent validity based on RHF state
     useEffect(() => {
        setValidity(allScoresAssigned && formIsValid);
     }, [formIsValid, allScoresAssigned, setValidity]);


    const rollStat = useCallback((): number => {
        const rolls = Array.from({ length: 4 }, () => rollDice('1d6'));
        rolls.sort((a, b) => a - b);
        rolls.shift(); // Remove lowest
        return rolls.reduce((sum, roll) => sum + roll, 0);
    }, []);

    const rollAllStats = useCallback(() => {
         if (editMode) {
             toast({ variant: "destructive", title: "Cannot Re-roll", description: "Ability scores cannot be re-rolled during editing." });
             return;
         }
        const newScores = Array.from({ length: 6 }, rollStat).sort((a, b) => b - a); // Sort descending
        setRolledScores(newScores);
        // Reset base score assignments
        setAssignedScores(ABILITIES.reduce((acc, ability) => { acc[ability] = null; return acc; }, {} as Partial<Record<keyof Step4FormData['stats'], number | null>>));
        toast({ title: "Stats Rolled!", description: "Assign the rolled scores to abilities." });
    }, [rollStat, toast, editMode]);

    // Handles assigning a rolled score to a BASE stat
     const handleAssignScore = (ability: keyof Step4FormData['stats'], scoreValueString: string | null) => {
         if (editMode) return; // Don't allow re-assignment in edit mode

          if (scoreValueString === UNASSIGN_VALUE) {
              // If unassigning, put the score back into rolledScores if it was there
              const currentBaseScore = assignedScores[ability];
              if (currentBaseScore !== null) {
                  setRolledScores(prev => [...prev, currentBaseScore].sort((a, b) => b - a));
              }
              // Set base score back to null
              setAssignedScores(prev => ({ ...prev, [ability]: null }));
              // Clear related Tasha's bonus if unassigning
               if (useTashasRules) {
                   setTashasBonuses(prev => {
                       const newState = { ...prev };
                       if (newState.plusTwo === ability) newState.plusTwo = null;
                       if (newState.plusOne === ability) newState.plusOne = null;
                       return newState;
                   });
               }

          } else {
              // Assigning a new score
              const score = scoreValueString ? parseInt(scoreValueString, 10) : null;
              if (score === null) return; // Should not happen if UNASSIGN_VALUE is handled

              // Remove the assigned score from available rolledScores
              setRolledScores(prev => {
                  const index = prev.indexOf(score);
                  if (index > -1) {
                      const nextScores = [...prev];
                      nextScores.splice(index, 1);
                      return nextScores;
                  }
                  return prev; // Should not happen if UI logic is correct
              });

              // Put the previously assigned score (if any) back into rolledScores
              const currentBaseScore = assignedScores[ability];
              if (currentBaseScore !== null) {
                  setRolledScores(prev => [...prev, currentBaseScore].sort((a, b) => b - a));
              }

              // Update the assignment with the new BASE score
              setAssignedScores(prev => ({ ...prev, [ability]: score }));
          }
     };


    const handleTashasBonusChange = (type: 'plusTwo' | 'plusOne', abilityValue: string) => {
        if (editMode) return; // Cannot change Tasha's in edit mode

         const selectedAbility = abilityValue === UNASSIGN_VALUE ? null : abilityValue as keyof Step4FormData['stats'];

        setTashasBonuses(prev => {
            const otherType = type === 'plusTwo' ? 'plusOne' : 'plusTwo';
            const newState = { ...prev };

            // If selecting 'None'
            if (selectedAbility === null) {
                 newState[type] = null;
                 return newState;
            }

            // Prevent assigning the same ability to both +2 and +1
            if (selectedAbility && prev[otherType] === selectedAbility) {
                newState[otherType] = null; // Clear the other bonus type
            }
            newState[type] = selectedAbility;
            return newState;
        });
    };

    const getModifier = (statValue: number | undefined | null): number => {
        if (statValue === null || statValue === undefined) return 0;
        return Math.floor(((statValue) - 10) / 2);
    };

    // Get final scores for display (calculated in the main useEffect)
    const displayScores = watch('stats') || data.stats || {};


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rolling and Assignment */}
            <div className="md:col-span-2 space-y-6">
                 <Card>
                     <CardHeader className="flex flex-row justify-between items-center">
                         <CardTitle>Ability Scores</CardTitle>
                          {!editMode && (
                            <Button type="button" variant="outline" size="sm" onClick={rollAllStats}>
                                <Dices className="mr-2 h-4 w-4" /> Roll (4d6 Drop Lowest)
                            </Button>
                          )}
                     </CardHeader>
                     <CardContent>
                         {!editMode && rolledScores.length === 0 && Object.values(assignedScores).every(s => s === null) && (
                             <p className="text-muted-foreground text-center">Roll stats to begin assignment or manually assign base scores below.</p>
                         )}
                         {!editMode && rolledScores.length > 0 && (
                             <div className="flex flex-wrap gap-4 justify-center mb-4 border-b pb-4">
                                  <Label className='w-full text-center text-sm text-muted-foreground'>Available Rolled Scores:</Label>
                                 {rolledScores.map((score, index) => (
                                     <Card key={`${score}-${index}`} className="p-3 text-center font-bold text-xl bg-secondary">
                                         {score}
                                     </Card>
                                 ))}
                                  {rolledScores.length === 0 && <p className='text-xs italic text-muted-foreground'>All scores assigned.</p>}
                             </div>
                         )}
                          {/* Assignment Section */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                             {ABILITIES.map(ability => (
                                  <div key={ability} className="space-y-1"> {/* Use stable key */}
                                      <Label htmlFor={`assign-${ability}`} className="uppercase text-xs font-semibold">{ability}</Label>
                                      {editMode ? (
                                          // Display assigned base score in edit mode (non-editable)
                                          <Input
                                              id={`assign-${ability}`}
                                              value={assignedScores[ability]?.toString() ?? ''}
                                              readOnly
                                              disabled
                                              className="text-center font-medium"
                                          />
                                      ) : (
                                         // Select dropdown for assignment in create mode
                                         <Select
                                               value={assignedScores[ability]?.toString() ?? ""} // Use empty string for placeholder if null
                                               onValueChange={(value) => handleAssignScore(ability, value)}
                                               disabled={rolledScores.length === 0 && assignedScores[ability] === null} // Disable if no scores rolled and not already assigned
                                         >
                                              <SelectTrigger id={`assign-${ability}`}>
                                                    {/* Use SelectValue to display the assigned score or placeholder */}
                                                    <SelectValue placeholder="Assign..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                   {/* Option to unassign - use UNASSIGN_VALUE */}
                                                   {assignedScores[ability] !== null && (
                                                       // Use a distinct, non-empty value for the 'unassign' option
                                                       <SelectItem value={UNASSIGN_VALUE}>Unassign ({assignedScores[ability]})</SelectItem>
                                                   )}
                                                   {/* Show available rolled scores */}
                                                   {rolledScores.map((score, index) => (
                                                       // Ensure score is string and not empty
                                                        <SelectItem key={`${score}-${index}`} value={String(score)}>
                                                           {score}
                                                       </SelectItem>
                                                   ))}
                                               </SelectContent>
                                          </Select>
                                       )}
                                  </div>
                              ))}
                          </div>

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
                                         disabled={editMode} // Disable Tasha's switch in edit mode
                                     />
                                     <Label htmlFor="tashas-rules" className="text-sm">Use Tasha's Rules (+2/+1)</Label>
                                 </div>

                                 {useTashasRules && !editMode ? (
                                     <div className='space-y-2'>
                                         <div>
                                             <Label htmlFor="tashas-plus-two" className="text-xs">Assign +2 Bonus</Label>
                                              <Select value={tashasBonuses.plusTwo ?? ""} onValueChange={(val) => handleTashasBonusChange('plusTwo', val)}>
                                                  <SelectTrigger id="tashas-plus-two">
                                                      <SelectValue placeholder="Select Ability..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {/* Use UNASSIGN_VALUE for the 'None' option */}
                                                      <SelectItem value={UNASSIGN_VALUE}>None</SelectItem>
                                                      {ABILITIES.map(ab => <SelectItem key={`p2-${ab}`} value={ab}>{ab.charAt(0).toUpperCase() + ab.slice(1)}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                         </div>
                                         <div>
                                              <Label htmlFor="tashas-plus-one" className="text-xs">Assign +1 Bonus</Label>
                                               <Select value={tashasBonuses.plusOne ?? ""} onValueChange={(val) => handleTashasBonusChange('plusOne', val)}>
                                                   <SelectTrigger id="tashas-plus-one">
                                                       <SelectValue placeholder="Select Ability..." />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                        {/* Use UNASSIGN_VALUE for the 'None' option */}
                                                       <SelectItem value={UNASSIGN_VALUE}>None</SelectItem>
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
                                            <p><i>(None defined or selected)</i></p>
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
                         {ABILITIES.map((ability) => {
                             const finalScore = displayScores[ability]; // This comes from form state (final calculated)
                             const modifier = getModifier(finalScore);
                             const baseScore = assignedScores[ability];
                             const bonus = racialBonuses[ability] || 0;
                             return (
                                <div key={`final-${ability}`} className="text-center p-2 border rounded-md bg-secondary/30 relative pt-5">
                                    <Label className="uppercase text-[0.65rem] font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{ability}</Label>
                                    <div className="relative mt-0.5">
                                        <div className="text-3xl font-bold text-center h-auto p-0 border-none bg-transparent">
                                           {finalScore ?? '-'}
                                        </div>
                                        <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-7 h-7 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">
                                            {modifier >= 0 ? '+' : ''}{modifier}
                                        </div>
                                    </div>
                                    <div className='text-[0.6rem] text-muted-foreground h-3 mt-1'>
                                        ({baseScore ?? '?'} Base + {bonus} Race)
                                    </div>
                                </div>
                             );
                         })}
                     </CardContent>
                     {!allScoresAssigned && <p className='text-center text-destructive text-xs pb-4'>Assign all base scores.</p>}
                 </Card>

            </div>
        </div>
    );
}

