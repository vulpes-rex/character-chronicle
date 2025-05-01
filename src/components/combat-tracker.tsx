
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { saveEncounter } from '@/services/encounter-service'; // Assuming update logic is in saveEncounter
import { addGameLogEntry } from '@/services/campaign-service';
import type { Encounter, EncounterParticipant, Campaign, Character, Monster } from '@/lib/types';
import { rollDice } from '@/lib/types';
import { Dices, ShieldAlert, HeartPulse, ChevronRight, ChevronLeft, RotateCw, Users, X, PlusCircle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { DDDiceRoller } from './dddice-roller';
import { Skeleton } from './ui/skeleton';


interface CombatTrackerProps {
    initialEncounter: Encounter;
    campaign: Campaign;
    characters: Character[]; // Full character data
    monsters: Array<{ instanceId: string; definition?: Monster }>; // Monster definitions linked by instanceId
}

// Function to sort participants by initiative (descending), breaking ties randomly or by DEX
function sortParticipantsByInitiative(participants: EncounterParticipant[]): EncounterParticipant[] {
    return [...participants].sort((a, b) => {
        const initA = a.initiative ?? -Infinity; // Treat null/undefined as lowest initiative
        const initB = b.initiative ?? -Infinity;
        if (initA !== initB) {
            return initB - initA; // Sort descending
        }
        // Tie-breaking (optional, e.g., random or DEX modifier)
        return Math.random() - 0.5;
    });
}


export function CombatTracker({ initialEncounter, campaign, characters, monsters }: CombatTrackerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user, userProfile } = useAuth(); // Get DM info

    const [encounter, setEncounter] = useState<Encounter>(initialEncounter);
    const [initiativeOrder, setInitiativeOrder] = useState<EncounterParticipant[]>([]);
    const [isRollingInitiative, setIsRollingInitiative] = useState(false);
    const [editingHpId, setEditingHpId] = useState<string | null>(null);
    const [tempHpInput, setTempHpInput] = useState<string>('');
    const [diceRollResult, setDiceRollResult] = useState<string | null>(null);
    const [rollerKey, setRollerKey] = useState(0);

    const isCombatRunning = useMemo(() => encounter.status === 'running', [encounter.status]);
    const currentParticipant = useMemo(() => {
        if (!isCombatRunning || encounter.currentTurnIndex === null || encounter.currentTurnIndex === undefined) {
            return null;
        }
        return initiativeOrder[encounter.currentTurnIndex];
    }, [isCombatRunning, encounter.currentTurnIndex, initiativeOrder]);


    // --- Mutations ---
    const updateEncounterMutation = useMutation({
        mutationFn: (updatedData: Partial<Encounter>) => saveEncounter({ ...encounter, ...updatedData }, user!.uid),
        onSuccess: (data) => {
            // Don't invalidate query here, rely on optimistic updates via setEncounter
            console.log('Encounter updated');
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Update Failed', description: `Could not save encounter changes: ${error.message}` });
            // TODO: Potentially revert local state if save fails
        },
    });

     const addLogEntryMutation = useMutation({
         mutationFn: (entryData: Omit<GameLogEntry, 'id' | 'timestamp' | 'campaignId'>) =>
             addGameLogEntry({ ...entryData, campaignId: campaign.id }),
         onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['gameLog', campaign.id] }); // Refetch logs
         },
         onError: (error) => {
             console.error('Failed to add log entry:', error);
         },
     });

    // --- Effects ---
    useEffect(() => {
        // Initialize or update initiative order when participants change or status becomes 'running'
        if (encounter.status === 'running' || encounter.status === 'setup') {
            setInitiativeOrder(sortParticipantsByInitiative(encounter.participants));
        }
    }, [encounter.participants, encounter.status]);


    // --- Initiative Rolling ---
    const rollAllInitiative = () => {
        if (isCombatRunning) return; // Don't re-roll if combat started

        setIsRollingInitiative(true);
        let logDetails = 'Initiative rolls: ';
        const updatedParticipants = encounter.participants.map(p => {
            let initiative = 0;
            if (p.type === 'character') {
                const char = characters.find(c => c.id === p.sourceId);
                const dexMod = char ? Math.floor((char.stats.dexterity - 10) / 2) : 0;
                initiative = rollDice('1d20') + dexMod;
            } else {
                const monsterDef = monsters.find(m => m.instanceId === p.id)?.definition;
                const dexMod = monsterDef?.stats?.dexterity ? Math.floor((monsterDef.stats.dexterity - 10) / 2) : 0;
                initiative = rollDice('1d20') + dexMod;
            }
             logDetails += `${p.name}: ${initiative}, `;
            return { ...p, initiative };
        });

        const sortedOrder = sortParticipantsByInitiative(updatedParticipants);
        setInitiativeOrder(sortedOrder);
        setEncounter(prev => ({ ...prev, participants: updatedParticipants })); // Update local state

        logDetails = logDetails.slice(0, -2); // Remove trailing comma and space
        addLogEntryMutation.mutate({ actorId: user?.uid || 'system', actorName: userProfile?.displayName || 'DM', actionType: 'initiativeRoll', details: logDetails });
        toast({ title: 'Initiative Rolled', description: 'Order set.' });
        setIsRollingInitiative(false);
    };

    // --- Combat Flow ---
    const startCombat = () => {
        if (!initiativeOrder.every(p => p.initiative !== null)) {
            toast({ variant: 'destructive', title: 'Roll Initiative First', description: 'Please roll initiative for all participants.' });
            return;
        }
        const newState: Encounter = {
            ...encounter,
            status: 'running',
            currentTurnIndex: 0,
            round: 1,
            participants: initiativeOrder // Use the rolled & sorted order
        };
        setEncounter(newState);
        updateEncounterMutation.mutate({ status: 'running', currentTurnIndex: 0, round: 1, participants: newState.participants });
        addLogEntryMutation.mutate({ actorId: user?.uid || 'system', actorName: userProfile?.displayName || 'DM', actionType: 'combatStart', details: `Combat started! Round 1. ${initiativeOrder[0]?.name}'s turn.` });
        toast({ title: 'Combat Started!', description: `${initiativeOrder[0]?.name} takes the first turn.` });
    };

    const nextTurn = () => {
        if (!isCombatRunning || encounter.currentTurnIndex === null || encounter.currentTurnIndex === undefined) return;

        let nextIndex = encounter.currentTurnIndex + 1;
        let nextRound = encounter.round || 1;

        if (nextIndex >= initiativeOrder.length) {
            nextIndex = 0;
            nextRound++;
        }

        const newState: Partial<Encounter> = {
            currentTurnIndex: nextIndex,
            round: nextRound,
        };
        setEncounter(prev => ({ ...prev, ...newState }));
        updateEncounterMutation.mutate(newState); // Save turn change
        addLogEntryMutation.mutate({ actorId: 'system', actorName: 'System', actionType: 'turnChange', details: `Round ${nextRound}. ${initiativeOrder[nextIndex]?.name}'s turn.` });
    };

    const previousTurn = () => {
        if (!isCombatRunning || encounter.currentTurnIndex === null || encounter.currentTurnIndex === undefined) return;

        let prevIndex = encounter.currentTurnIndex - 1;
        let prevRound = encounter.round || 1;

        if (prevIndex < 0) {
            if (prevRound <= 1) {
                toast({ variant: 'destructive', title: 'Cannot Go Back', description: 'Already at the start of combat.' });
                return; // Cannot go back further than the first turn of round 1
            }
            prevIndex = initiativeOrder.length - 1;
            prevRound--;
        }

        const newState: Partial<Encounter> = {
            currentTurnIndex: prevIndex,
            round: prevRound,
        };
        setEncounter(prev => ({ ...prev, ...newState }));
        updateEncounterMutation.mutate(newState);
         addLogEntryMutation.mutate({ actorId: 'system', actorName: 'System', actionType: 'turnChange', details: `Moved back to Round ${prevRound}. ${initiativeOrder[prevIndex]?.name}'s turn.` });
    };


    const endCombat = () => {
        const newState: Partial<Encounter> = { status: 'completed', currentTurnIndex: null };
        setEncounter(prev => ({ ...prev, ...newState }));
        updateEncounterMutation.mutate(newState);
        addLogEntryMutation.mutate({ actorId: user?.uid || 'system', actorName: userProfile?.displayName || 'DM', actionType: 'combatEnd', details: 'Combat ended.' });
        toast({ title: 'Combat Ended' });
    };


    // --- Participant HP Management ---
    const handleHpChange = (participantId: string, amount: number) => {
        let newHp = 0;
        const updatedParticipants = encounter.participants.map(p => {
             if (p.id === participantId) {
                newHp = Math.max(0, Math.min(p.maxHp, p.currentHp + amount));
                return { ...p, currentHp: newHp };
             }
             return p;
         });

         const participant = encounter.participants.find(p => p.id === participantId);
         if (!participant) return;

         setEncounter(prev => ({ ...prev, participants: updatedParticipants }));
         updateEncounterMutation.mutate({ participants: updatedParticipants }); // Save HP change

         const changeType = amount > 0 ? 'healed' : 'damaged';
         const changeAmount = Math.abs(amount);
          addLogEntryMutation.mutate({ actorId: user?.uid || 'system', actorName: userProfile?.displayName || 'DM', actionType: 'hpChange', details: `${participant.name} ${changeType} for ${changeAmount} HP. Current HP: ${newHp}.` });
    };

    const handleHpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
       setTempHpInput(e.target.value);
    };

    const commitHpChange = (participantId: string) => {
       const value = parseInt(tempHpInput, 10);
       if (!isNaN(value)) {
          const participant = encounter.participants.find(p => p.id === participantId);
          if (participant) {
              const newHp = Math.max(0, Math.min(participant.maxHp, value));
              const updatedParticipants = encounter.participants.map(p =>
                  p.id === participantId ? { ...p, currentHp: newHp } : p
              );
              setEncounter(prev => ({ ...prev, participants: updatedParticipants }));
               updateEncounterMutation.mutate({ participants: updatedParticipants });
               addLogEntryMutation.mutate({ actorId: user?.uid || 'system', actorName: userProfile?.displayName || 'DM', actionType: 'hpSet', details: `${participant.name}'s HP set to ${newHp}.` });
          }
       }
       setEditingHpId(null);
       setTempHpInput('');
    };

     const startHpEdit = (participantId: string, currentHp: number) => {
        setEditingHpId(participantId);
        setTempHpInput(String(currentHp));
    };


    // --- Render ---
    return (
        <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
             {diceRollResult && <DDDiceRoller key={rollerKey} resultText={diceRollResult} />}
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                            <CardTitle className="text-2xl flex items-center gap-2"><Swords /> {encounter.name}</CardTitle>
                            <CardDescription>{campaign.name} - Status: <Badge variant={isCombatRunning ? "destructive" : "secondary"}>{encounter.status}</Badge></CardDescription>
                        </div>
                         <div className='flex gap-2 items-center'>
                             {isCombatRunning && <span className="font-semibold">Round: {encounter.round ?? 0}</span>}
                             <Link href={`/dm/encounters/edit/${encounter.id}`}>
                                <Button variant="outline" size="sm">Edit Setup</Button>
                             </Link>
                         </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Controls */}
            {!isCombatRunning ? (
                <Card>
                    <CardContent className="pt-6 flex justify-center gap-4">
                        <Button onClick={rollAllInitiative} disabled={isRollingInitiative} size="lg">
                            {isRollingInitiative ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
                            Roll All Initiative
                        </Button>
                         <Button onClick={startCombat} disabled={isRollingInitiative || !encounter.participants.length} size="lg" variant="destructive">
                             Start Combat
                         </Button>
                    </CardContent>
                </Card>
             ) : (
                <Card>
                    <CardContent className="pt-6 flex justify-center items-center gap-4">
                         <Button onClick={previousTurn} size="lg" variant="outline" title="Previous Turn">
                             <ChevronLeft />
                         </Button>
                         <div className='text-center'>
                             <div className='text-sm text-muted-foreground'>Current Turn</div>
                             <div className='text-xl font-bold'>{currentParticipant?.name ?? 'N/A'}</div>
                         </div>
                         <Button onClick={nextTurn} size="lg" variant="outline" title="Next Turn">
                             <ChevronRight />
                         </Button>
                         <Button onClick={endCombat} size="lg" variant="secondary" className='ml-auto'>
                             End Combat
                         </Button>
                    </CardContent>
                </Card>
             )}

            {/* Initiative Tracker */}
            <Card className="flex-grow flex flex-col overflow-hidden">
                <CardHeader>
                    <CardTitle>Initiative Order</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                    {initiativeOrder.length === 0 && <p className="text-muted-foreground text-center">No participants yet.</p>}
                    <ul className="space-y-3">
                        {initiativeOrder.map((p, index) => (
                            <li
                                key={p.id}
                                className={`border rounded-lg p-3 transition-all duration-300 ${index === encounter.currentTurnIndex && isCombatRunning ? 'ring-2 ring-primary shadow-lg scale-[1.01]' : 'opacity-80 hover:opacity-100'}`}
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-3 flex-grow min-w-0">
                                        <Badge variant="secondary" className="text-lg font-bold w-10 h-10 flex items-center justify-center shrink-0">{p.initiative ?? '?'}</Badge>
                                        <div className='min-w-0'>
                                            <p className="font-medium text-lg truncate" title={p.name}>{p.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {p.type === 'character' ? 'Player Character' : monsters.find(m => m.instanceId === p.id)?.definition?.type || 'Monster'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end w-full sm:w-auto flex-wrap shrink-0">
                                         {/* HP Editor */}
                                         <div className="flex items-center gap-1">
                                            <Button variant="outline" size="xs" className="h-6 w-6 p-0" onClick={() => handleHpChange(p.id, -1)}><MinusCircle className="h-3 w-3"/></Button>
                                             {editingHpId === p.id ? (
                                                 <Input
                                                    type="number"
                                                    value={tempHpInput}
                                                    onChange={handleHpInputChange}
                                                    onBlur={() => commitHpChange(p.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && commitHpChange(p.id)}
                                                    className="w-16 h-7 text-center font-semibold text-base"
                                                    autoFocus
                                                    min={0}
                                                    max={p.maxHp}
                                                />
                                             ) : (
                                                <Button
                                                    variant="ghost"
                                                    className="h-7 px-1 text-center font-semibold text-base min-w-[40px]"
                                                    onClick={() => startHpEdit(p.id, p.currentHp)}
                                                    title="Click to edit HP"
                                                >
                                                    {p.currentHp}
                                                </Button>
                                             )}
                                             <span className="text-sm text-muted-foreground">/ {p.maxHp} HP</span>
                                              <Button variant="outline" size="xs" className="h-6 w-6 p-0" onClick={() => handleHpChange(p.id, 1)}><PlusCircle className="h-3 w-3"/></Button>
                                         </div>
                                         <Badge variant="outline" title="Armor Class">AC {p.armorClass}</Badge>
                                     </div>
                                </div>
                                 {/* HP Bar */}
                                <Progress value={(p.currentHp / p.maxHp) * 100} className="h-1.5 mt-2" />
                                 {/* Conditions (Optional) */}
                                {/* {p.conditions && p.conditions.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {p.conditions.map(cond => <Badge key={cond} variant="destructive" className='text-xs'>{cond}</Badge>)}
                                    </div>
                                )} */}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

// CombatTracker Skeleton
export function CombatTrackerSkeleton() {
    return (
        <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
             <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                             <Skeleton className="h-8 w-48 mb-2" />
                             <Skeleton className="h-4 w-32" />
                        </div>
                         <div className='flex gap-2 items-center'>
                             <Skeleton className="h-6 w-16" />
                             <Skeleton className="h-8 w-24" />
                         </div>
                    </div>
                </CardHeader>
            </Card>
             <Card>
                 <CardContent className="pt-6 flex justify-center gap-4">
                     <Skeleton className="h-12 w-48" />
                     <Skeleton className="h-12 w-36" />
                 </CardContent>
             </Card>
             <Card className="flex-grow flex flex-col overflow-hidden">
                <CardHeader>
                    <Skeleton className="h-6 w-36" />
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                    <ul className="space-y-3">
                        {[1, 2, 3].map(i => (
                             <li key={i} className="border rounded-lg p-3">
                                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-3 flex-grow">
                                         <Skeleton className="h-10 w-10 rounded-full" />
                                         <div className='flex-grow'>
                                             <Skeleton className="h-6 w-3/4 mb-1" />
                                             <Skeleton className="h-3 w-1/2" />
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                                         <Skeleton className="h-7 w-24" />
                                         <Skeleton className="h-7 w-12" />
                                     </div>
                                 </div>
                                  <Skeleton className="h-1.5 mt-2 w-full" />
                             </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

