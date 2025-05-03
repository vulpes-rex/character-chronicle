'use client';

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Dices, Minus, Plus, X } from 'lucide-react'; // Added Minus, Plus, X
import { rollDice } from '@/lib/types'; // Import rollDice utility

interface FloatingDiceRollerProps {
    onRoll: (rollString: string, result: number) => void; // Callback to send roll data
}

export function FloatingDiceRoller({ onRoll }: FloatingDiceRollerProps) {
    const [numDice, setNumDice] = useState<{ [key: string]: number }>({
        d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 1 // Default to 1d20
    });
    const [modifier, setModifier] = useState(0);
    const [show, setShow] = useState(false);
    const { toast } = useToast();

    const handleNumDiceChange = (diceType: string, change: number) => {
        setNumDice(prev => ({
            ...prev,
            [diceType]: Math.max(0, (prev[diceType] || 0) + change)
        }));
    };

    const handleModifierChange = (change: number) => {
        setModifier(prev => prev + change);
    };

    const rollDiceAndLog = useCallback(() => {
        let total = 0;
        let descriptionParts: string[] = [];

        // Roll each type of dice
        Object.entries(numDice).forEach(([diceType, count]) => {
            if (count > 0) {
                let diceTotal = 0;
                for (let i = 0; i < count; i++) {
                     // Use the imported rollDice for consistency, though simple rolls are fine too
                    diceTotal += Math.floor(Math.random() * parseInt(diceType.substring(1))) + 1;
                }
                total += diceTotal;
                descriptionParts.push(`${count}${diceType}`);
            }
        });

        // Add modifier
        if (modifier !== 0) {
            total += modifier;
            descriptionParts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
        }

        // Format description string
        const description = descriptionParts.join(' ');
        const displayDescription = description || 'No dice selected'; // Show something if empty

        if (descriptionParts.length === 0 && modifier === 0) {
            toast({ variant: "destructive", title: "No Dice", description: "Please select dice or a modifier to roll." });
            return;
        }


        // Call the onRoll callback to send the raw dice string and total result upwards
        onRoll(displayDescription, total);

        // Optionally, show a local toast confirmation
        // toast({
        //     title: "Dice Roll",
        //     description: `${displayDescription} = ${total}`,
        // });

    }, [numDice, modifier, onRoll, toast]);

    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

    return (
        <>
            {/* Toggle Button */}
            <Button
                variant="secondary"
                size="icon"
                className="fixed bottom-5 left-5 z-[1001] rounded-full shadow-lg"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide Dice Roller" : "Show Dice Roller"}
            >
                <Dices />
            </Button>

            {/* Roller Panel */}
            {show && (
                <Card className="fixed bottom-[70px] left-5 z-[1000] w-auto shadow-xl bg-card/90 backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2">
                    <CardContent className="p-3">
                        <div className="flex flex-col gap-2">
                            {/* Dice Selection Row */}
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
                                {diceTypes.map(dice => (
                                    <div key={dice} className="flex flex-col items-center gap-1">
                                        <Label className="text-xs font-semibold">{dice.toUpperCase()}</Label>
                                        <div className="flex items-center gap-1">
                                             <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleNumDiceChange(dice, -1)}><Minus className="h-3 w-3"/></Button>
                                             <span className="text-sm font-medium w-6 text-center">{numDice[dice]}</span>
                                             <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleNumDiceChange(dice, 1)}><Plus className="h-3 w-3"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             {/* Modifier Row */}
                            <div className="flex flex-col items-center gap-1 pt-2 border-t">
                                <Label className="text-xs font-semibold">Modifier</Label>
                                 <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleModifierChange(-1)}><Minus className="h-3 w-3"/></Button>
                                     <span className="text-sm font-medium w-10 text-center tabular-nums">{modifier >= 0 ? `+${modifier}` : modifier}</span>
                                     <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleModifierChange(1)}><Plus className="h-3 w-3"/></Button>
                                 </div>
                            </div>

                             {/* Roll Button */}
                            <Button variant="default" size="sm" onClick={rollDiceAndLog} className="mt-2">
                                <Dices className="mr-2 h-4 w-4" />
                                Roll
                            </Button>
                         </div>
                         {/* Close Button */}
                         <Button
                             variant="ghost"
                             size="icon"
                             className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                             onClick={() => setShow(false)}
                         >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
