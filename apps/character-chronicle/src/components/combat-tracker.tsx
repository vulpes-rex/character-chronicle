'use client';

import { useState, useEffect } from 'react';
import type { Encounter, Character, Monster, NPC, EncounterParticipant } from '@/lib/types'; // Use alias
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // Use alias
import { Badge } from '@/components/ui/badge'; // Use alias
import { Checkbox } from '@/components/ui/checkbox'; // Use alias
import { Separator } from '@/components/ui/separator'; // Use alias
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Use alias
import { ChevronUp, ChevronDown, Play, Square, Trash2, Shield, Heart, Dices, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { updateEncounterStateAction } from '@/app/actions/encounter-actions'; // Use Server Action
import { useAuth } from './auth-provider'; // Use alias

type CombinedParticipant = EncounterParticipant & {
    definition?: Character | Monster | NPC;
};

interface CombatTrackerProps {
  initialEncounter: Encounter;
  campaign: any; // Add campaign prop if needed for context
  characters: Character[];
  monsters: Array<{ instanceId: string; definition?: Monster }>;
  npcs: Array<{ instanceId: string; definition?: NPC }>; // Added NPCs
}

export function CombatTracker({ initialEncounter, characters, monsters, npcs }: CombatTrackerProps) {
  const [encounter, setEncounter] = useState<Encounter>(initialEncounter);
  const [participants, setParticipants] = useState<CombinedParticipant[]>([]);
  const [round, setRound] = useState(initialEncounter.round || 0);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(initialEncounter.currentTurnIndex ?? -1);
  const [isCombatRunning, setIsCombatRunning] = useState(initialEncounter.status === 'running');
  const [initiatives, setInitiatives] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(false); // For async operations
  const { toast } = useToast();
  const { user } = useAuth(); // Get user for permission checks if needed

  useEffect(() => {
    // Combine participants with their definitions
    const combined: CombinedParticipant[] = encounter.participants.map(p => {
      let definition: Character | Monster | NPC | undefined;
      if (p.type === 'character') {
        definition = characters.find(c => c.id === p.sourceId);
      } else if (p.type === 'monster') {
        definition = monsters.find(m => m.instanceId === p.id)?.definition;
      } else if (p.type === 'npc') {
         definition = npcs.find(n => n.instanceId === p.id)?.definition;
      }
      return { ...p, definition };
    });

     // Initialize initiatives from encounter state or empty object
     const initialInits: Record<string, number | null> = {};
     combined.forEach(p => {
       initialInits[p.id] = p.initiative === undefined ? null : p.initiative;
     });
     setInitiatives(initialInits);


    // Sort participants if initiatives are set and combat is running
    if (isCombatRunning && Object.values(initialInits).some(i => i !== null)) {
        combined.sort((a, b) => (b.initiative ?? -1) - (a.initiative ?? -1));
    }

    setParticipants(combined);
    setRound(encounter.round || 0);
    setCurrentTurnIndex(encounter.currentTurnIndex ?? -1);
    setIsCombatRunning(encounter.status === 'running');

  }, [initialEncounter, characters, monsters, npcs]); // Rerun when initial data changes


   // Function to persist encounter state changes via Server Action
   const updateEncounterState = async (updates: Partial<Encounter>) => {
      if (!user) { // Basic check, replace with proper DM check if needed
          toast({ variant: 'destructive', title: 'Error', description: 'Not authorized.' });
          return;
      }
       setIsLoading(true);
       try {
           const result = await updateEncounterStateAction(encounter.id, updates, user.uid); // Pass DM user ID
           if (!result.success) {
               throw new Error(result.error || 'Failed to update encounter state.');
           }
           // Optionally update local state based on response or refetch,
           // for now, assume the update was successful server-side.
           // Example: If action returned the updated encounter:
           // setEncounter(result.encounter);
           toast({ title: 'Encounter Updated', description: 'Changes saved successfully.' });
       } catch (error: any) {
           toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
       } finally {
           setIsLoading(false);
       }
   };


  const handleInitiativeChange = (id: string, value: string) => {
    const newInitiative = value === '' ? null : parseInt(value, 10);
    setInitiatives(prev => ({ ...prev, [id]: isNaN(newInitiative as number) ? null : newInitiative }));
  };

  const rollAllInitiatives = () => {
     const newInits: Record<string, number | null> = {};
     participants.forEach(p => {
         const dexMod = (p.type === 'character' || p.type === 'npc')
             ? Math.floor(((p.definition as Character | NPC)?.stats?.dexterity || 10) - 10) / 2
             : Math.floor(((p.definition as Monster)?.stats?.dexterity || 10) - 10) / 2;
         newInits[p.id] = Math.floor(Math.random() * 20) + 1 + dexMod;
     });
     setInitiatives(newInits);
     // Persist initiatives immediately? Or wait for Start Combat?
     // updateEncounterState({ participants: participants.map(p => ({...p, initiative: newInits[p.id]})) });
  };

  const sortParticipantsByInitiative = () => {
      const sorted = [...participants].sort((a, b) => (initiatives[b.id] ?? -1) - (initiatives[a.id] ?? -1));
      setParticipants(sorted);
      // Update participant initiatives in the main encounter state
      const updatedParticipants = sorted.map(p => ({
          ...p,
          initiative: initiatives[p.id] // Get initiative from the local state
      }));
       // Persist sorted order and initiatives
      updateEncounterState({ participants: updatedParticipants });
  };

  const startCombat = () => {
    if (Object.values(initiatives).some(i => i === null)) {
        toast({ variant: 'destructive', title: 'Cannot Start Combat', description: 'All participants must have initiative rolled.' });
        return;
    }
    sortParticipantsByInitiative(); // Sort before starting
    setIsCombatRunning(true);
    setCurrentTurnIndex(0);
    setRound(1);
     // Persist state change
    updateEncounterState({
         status: 'running',
         currentTurnIndex: 0,
         round: 1,
         participants: participants.map(p => ({ // Ensure initiatives are saved
             ...p,
             initiative: initiatives[p.id]
         }))
    });
  };

  const endCombat = () => {
    setIsCombatRunning(false);
    setCurrentTurnIndex(-1);
    // Persist state change
    updateEncounterState({ status: 'completed', currentTurnIndex: -1 });
  };

  const nextTurn = () => {
    if (!isCombatRunning) return;
    let nextIndex = (currentTurnIndex + 1);
    let nextRound = round;
    if (nextIndex >= participants.length) {
      nextIndex = 0;
      nextRound += 1;
      setRound(nextRound);
       // TODO: Handle round-based effects (recharge, condition duration)
    }
    setCurrentTurnIndex(nextIndex);
    // Persist state change
    updateEncounterState({ currentTurnIndex: nextIndex, round: nextRound });
  };

  const prevTurn = () => {
     if (!isCombatRunning || (currentTurnIndex === 0 && round <= 1)) return;
     let prevIndex = currentTurnIndex - 1;
     let prevRound = round;
     if (prevIndex < 0) {
         prevIndex = participants.length - 1;
         prevRound -= 1;
         setRound(prevRound);
     }
      setCurrentTurnIndex(prevIndex);
      // Persist state change
     updateEncounterState({ currentTurnIndex: prevIndex, round: prevRound });
  };

 const handleHpChange = (id: string, newHp: number) => {
     setParticipants(prev => prev.map(p => p.id === id ? { ...p, currentHp: Math.max(0, newHp) } : p)); // Ensure HP doesn't go below 0 visually
     // Persist HP change (debounced or immediate)
     // Consider debouncing if updates are frequent
     const updatedParticipants = participants.map(p => p.id === id ? { ...p, currentHp: Math.max(0, newHp) } : p);
     updateEncounterState({ participants: updatedParticipants }); // Update server state
 };

  // TODO: Implement Add/Remove Participant functionality
  // TODO: Implement Condition Tracking UI and logic

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{encounter.name}</CardTitle>
          <div className="flex space-x-2">
            {!isCombatRunning ? (
              <>
                <Button onClick={rollAllInitiatives} size="sm" variant="outline" disabled={isLoading}>
                    <Dices className="mr-2 h-4 w-4" /> Roll All Initiative
                </Button>
                <Button onClick={startCombat} size="sm" disabled={isLoading || Object.values(initiatives).some(i => i === null)}>
                  <Play className="mr-2 h-4 w-4" /> Start Combat
                </Button>
              </>
            ) : (
               <>
                 <Button onClick={prevTurn} size="sm" variant="outline" disabled={isLoading || (currentTurnIndex === 0 && round <= 1)}>
                     <ChevronUp className="mr-2 h-4 w-4" /> Previous Turn
                 </Button>
                 <Button onClick={nextTurn} size="sm" variant="outline" disabled={isLoading}>
                     Next Turn <ChevronDown className="ml-2 h-4 w-4" />
                 </Button>
                 <Button onClick={endCombat} size="sm" variant="destructive" disabled={isLoading}>
                   <Square className="mr-2 h-4 w-4" /> End Combat
                 </Button>
               </>
            )}
          </div>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">{encounter.description || 'No description provided.'}</p>
           {isCombatRunning && <p className="mt-2 font-semibold">Round: {round}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
           {/* Add buttons for Add/Remove Participant */}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Init</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">HP</TableHead>
                  <TableHead className="w-[80px]">AC</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead className="w-[50px]">Info</TableHead>
                  <TableHead className="w-[50px]">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p, index) => (
                  <TableRow key={p.id} className={cn(isCombatRunning && index === currentTurnIndex && "bg-primary/10 ring-2 ring-primary")}>
                    <TableCell>
                      <Input
                        type="number"
                        value={initiatives[p.id] ?? ''}
                        onChange={(e) => handleInitiativeChange(p.id, e.target.value)}
                        className="h-8 w-14 text-center"
                        disabled={isCombatRunning || isLoading}
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                       {p.name} <Badge variant="outline" className="ml-2 text-xs">{p.type}</Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center space-x-1">
                            <Input
                                type="number"
                                value={p.currentHp}
                                onChange={(e) => handleHpChange(p.id, parseInt(e.target.value))}
                                className="h-8 w-16 text-center"
                                max={p.maxHp}
                                min={0}
                                disabled={isLoading}
                            />
                            <span className="text-muted-foreground text-xs">/ {p.maxHp}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">{p.armorClass}</TableCell>
                    <TableCell>
                        {/* TODO: Condition Badges/Management */}
                         <Badge variant="secondary">Normal</Badge>
                    </TableCell>
                     <TableCell>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Type: {p.definition?.type || 'N/A'}</p>
                                    <p>Size: {p.definition?.size || 'N/A'}</p>
                                    {/* Add more relevant info from definition */}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </TableCell>
                    <TableCell>
                       <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLoading} onClick={() => alert('Remove participant not implemented')}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


// Skeleton loader for the combat tracker
export function CombatTrackerSkeleton() {
    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-8 w-1/2" />
                    <div className="flex space-x-2">
                       <Skeleton className="h-9 w-24" />
                       <Skeleton className="h-9 w-24" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-3/4" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center space-x-4 p-2 border-b">
                                <Skeleton className="h-8 w-14" />
                                <Skeleton className="h-5 w-32 flex-1" />
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-5 w-10" />
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    