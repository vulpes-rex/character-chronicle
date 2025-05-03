'use client';

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dices, Plus, Minus, X } from 'lucide-react';
import { useDiceRoller } from '@/components/dice-roll-context'; // Correct path
import { cn } from '@/lib/utils'; // Use alias

const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

export function FloatingDiceRoller() {
    const [isOpen, setIsOpen] = useState(false);
    const [numDice, setNumDice] = useState(1);
    const [diceType, setDiceType] = useState("d20");
    const [modifier, setModifier] = useState(0);
    const { rollDice } = useDiceRoller(); // Use the context hook

    const handleRoll = () => {
        const modString = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
        const diceNotation = `${numDice}${diceType}${modString}`;
        rollDice(diceNotation, "Manual Roll"); // Trigger the roll via context
    };

    const incrementDice = () => setNumDice(n => Math.max(1, n + 1));
    const decrementDice = () => setNumDice(n => Math.max(1, n - 1));
    const incrementModifier = () => setModifier(m => m + 1);
    const decrementModifier = () => setModifier(m => m - 1);

    if (!isOpen) {
        return (
            <Button
                variant="default"
                size="icon"
                className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 h-14 w-14"
                onClick={() => setIsOpen(true)}
                title="Open Dice Roller"
            >
                <Dices className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-4 right-4 w-80 shadow-xl z-50 p-4 bg-card border rounded-lg">
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Close Dice Roller"
            >
                <X className="h-4 w-4" />
            </Button>
            <CardContent className="p-0 space-y-3">
                <h4 className="text-sm font-medium text-center mb-2">Quick Roller</h4>
                <div className="flex items-center justify-center space-x-2">
                    {/* Number of Dice */}
                    <div className="flex items-center space-x-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={decrementDice}> <Minus className="h-4 w-4"/> </Button>
                        <Input
                            type="number"
                            value={numDice}
                            onChange={(e) => setNumDice(Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-8 w-12 text-center"
                            min="1"
                            aria-label="Number of Dice"
                        />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={incrementDice}> <Plus className="h-4 w-4"/> </Button>
                    </div>

                    {/* Dice Type Select */}
                    <Select value={diceType} onValueChange={setDiceType}>
                        <SelectTrigger className="h-8 w-[80px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DICE_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Modifier */}
                     <div className="flex items-center space-x-1">
                         <Button variant="outline" size="icon" className="h-8 w-8" onClick={decrementModifier}> <Minus className="h-4 w-4"/> </Button>
                         <Input
                             type="number"
                             value={modifier}
                             onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                             className="h-8 w-12 text-center"
                             aria-label="Modifier"
                         />
                         <Button variant="outline" size="icon" className="h-8 w-8" onClick={incrementModifier}> <Plus className="h-4 w-4"/> </Button>
                     </div>
                </div>

                {/* Roll Button */}
                <Button className="w-full" onClick={handleRoll}>
                    <Dices className="mr-2 h-4 w-4" />
                    Roll ({`${numDice}${diceType}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`})
                </Button>
            </CardContent>
        </Card>
    );
}
